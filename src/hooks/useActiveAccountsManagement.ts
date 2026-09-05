/** Self-contained state + handlers for the Active Accounts management UI
 * (users table, invite / manual add / unified archive (optional customer
 * reassignment) / restore / set-password / send-sign-in-email /
 * convert-master). Lifted verbatim from
 * Settings.tsx so the same panel can render inline in Settings and inside the
 * app-level Active Accounts modal. `enabled` gates data loading (the modal only
 * loads while open); `onDataChanged` lets the host page refresh its own lists
 * after a successful mutation. */
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth, type UserRole } from './useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import type { ServiceType, UserRow } from '../types/settingsRows'
import { cascadePersonNameInPayTables, getPersonNamesForUser } from '../lib/cascadePersonName'
import { EXTERNAL_MERGE_OPTION_PREFIX } from '../lib/mergeUserAccounts'
import { archiveChoiceBlocker, archiveRequestBody, type ArchiveReassignMode } from '../lib/archiveUserDialog'
import { executeCombinePeople, previewCombinePeople } from '../lib/combinePeople'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { inviteFormValid, roleChangeConfirmMessage, roleChosen, roleTakesServiceTypes, userCreatedTelemetryTarget, type RoleChoice } from '../lib/inviteUserForm'
import { recordNavClick } from '../lib/navClickTelemetry'

/** External roster person (no login) offered as a merge-away candidate for subcontractor survivors. */
export type ExternalMergePerson = {
  id: string
  name: string
  kind: string
  master_user_id: string
  account_user_id: string | null
}

export type UseActiveAccountsManagementOptions = {
  enabled: boolean
  onDataChanged?: () => void
}

export function useActiveAccountsManagement({ enabled, onDataChanged }: UseActiveAccountsManagementOptions) {
  const { user: authUser, role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()

  const [users, setUsers] = useState<UserRow[]>([])
  const [ctSeatByUserId, setCtSeatByUserId] = useState<Record<string, string | null> | null>(null)
  const [creatingCtSeatId, setCreatingCtSeatId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [archivedUsers, setArchivedUsers] = useState<UserRow[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  // No privileged default: the role is an explicit choice (v2 "the invite moment"). '' until chosen.
  const [inviteRole, setInviteRole] = useState<RoleChoice>('')
  const [inviteTraining, setInviteTraining] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteServiceTypeIds, setInviteServiceTypeIds] = useState<string[]>([])
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [manualAddEmail, setManualAddEmail] = useState('')
  const [manualAddName, setManualAddName] = useState('')
  const [manualAddRole, setManualAddRole] = useState<RoleChoice>('')
  const [manualAddTraining, setManualAddTraining] = useState(false)
  const [manualAddPassword, setManualAddPassword] = useState('')
  const [manualAddServiceTypeIds, setManualAddServiceTypeIds] = useState<string[]>([])
  const [manualAddError, setManualAddError] = useState<string | null>(null)
  const [manualAddSubmitting, setManualAddSubmitting] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  /** True when the dialog was opened from the top button (shows the account picker). */
  const [archiveConfirmPicker, setArchiveConfirmPicker] = useState(false)
  const [archiveReassignMode, setArchiveReassignMode] = useState<ArchiveReassignMode>('keep')
  const [archiveReassignTargetId, setArchiveReassignTargetId] = useState('')
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
  const [externalSubPeople, setExternalSubPeople] = useState<ExternalMergePerson[]>([])
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
  const [editTeamProspectsAccess, setEditTeamProspectsAccess] = useState(false)
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
      .select('id, email, name, role, last_sign_in_at, read_only, estimator_prospects_access, team_prospects_access, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids, subcontractor_service_type_ids, helpers_service_type_ids')
      .is('archived_at', null)
      .order('name')
    if (eList) setError(eList.message)
    else setUsers((list as UserRow[]) ?? [])
    await loadCtSeats()
  }

  /** CT bridge join keys (v2.2435), fail-soft: separate cast query so the panel works
   * before migration 20260828090000 lands — null map hides the CT seat UI entirely. */
  async function loadCtSeats() {
    try {
      const { data, error: eSeats } = await (supabase as never as {
        from: (t: string) => { select: (c: string) => { is: (k: string, v: null) => Promise<{ data: { id: string; counttooling_user_id: string | null }[] | null; error: unknown }> } }
      })
        .from('users')
        .select('id, counttooling_user_id')
        .is('archived_at', null)
      if (eSeats || !data) {
        setCtSeatByUserId(null)
        return
      }
      const map: Record<string, string | null> = {}
      for (const row of data) map[row.id] = row.counttooling_user_id
      setCtSeatByUserId(map)
    } catch {
      setCtSeatByUserId(null)
    }
  }

  /** Create (or find, idempotently) a CountTooling seat for this person over the bridge
   * and store the uuid join key. Manual, on demand — CT is an estimator tool, so only
   * the people who need it get a seat (locked decision). */
  async function handleCreateCtSeat(u: UserRow) {
    setCreatingCtSeatId(u.id)
    try {
      const { data, error: eFn } = await supabase.functions.invoke('ct-bridge', {
        body: { verb: 'create', email: u.email, name: u.name ?? undefined },
      })
      const ctId = (data as { ct_user_id?: string } | null)?.ct_user_id
      if (eFn || !ctId) {
        showToast(`CountTooling seat failed: ${eFn?.message ?? (data as { error?: string } | null)?.error ?? 'no uuid returned'}`, 'error')
        return
      }
      const { error: upErr } = await (supabase as never as {
        from: (t: string) => { update: (v: object) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } }
      })
        .from('users')
        .update({ counttooling_user_id: ctId })
        .eq('id', u.id)
      if (upErr) {
        showToast(`CT seat created (${ctId}) but the link didn’t save: ${upErr.message}`, 'error')
        return
      }
      showToast(`CountTooling seat ready for ${u.name || u.email}`, 'success')
      await loadCtSeats()
    } finally {
      setCreatingCtSeatId(null)
    }
  }

  /** Active roster people with no login account, kind 'sub' — merge-away candidates for subcontractor survivors. */
  async function loadExternalSubPeople() {
    const { data, error: ePeople } = await supabase
      .from('people')
      .select('id, name, kind, master_user_id, account_user_id')
      .eq('kind', 'sub')
      .is('archived_at', null)
      .is('account_user_id', null)
      .order('name')
    if (ePeople) setError(ePeople.message)
    else setExternalSubPeople((data as ExternalMergePerson[]) ?? [])
  }

  /** Refresh the panel's own data after a successful mutation, then let the host page refresh its lists. */
  async function reloadAfterMutation() {
    await Promise.all([loadUsers(), loadArchivedUsers(), loadExternalSubPeople()])
    onDataChanged?.()
  }

  const loadAll = useCallback(async () => {
    await Promise.all([loadUsers(), loadArchivedUsers(), loadServiceTypes(), loadExternalSubPeople()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])

  useEffect(() => {
    if (!enabled) return
    void loadAll()
  }, [enabled, loadAll])

  async function updateRole(id: string, role: UserRole) {
    const target = users.find((u) => u.id === id)
    if (target && target.role === role) return
    // Desk precedent (PersonDeskAccessSection.setRole): confirm before re-roling a live account.
    // The select is controlled by `users`, so Cancel leaves it showing the current role.
    const ok = await confirmDialog({
      message: roleChangeConfirmMessage(target?.name || target?.email || 'this account', target?.role, role),
      confirmLabel: 'Change role',
    })
    if (!ok) return
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
    // Reconcile from what the DB actually returned, never from what we asked for. RLS blocks an UPDATE by
    // filtering it to zero rows rather than erroring, so assuming success here would render a write that
    // never happened as though it had (e.g. a read-only user trying to clear their own flag).
    const { data, error: e } = await supabase
      .from('users')
      .update({ read_only: readOnly })
      .eq('id', id)
      .select('id, read_only')
    const savedRow = data?.[0]
    if (e) {
      setError(e.message)
    } else if (!savedRow) {
      setError('That change did not apply — you may not have permission to change this account.')
    } else {
      const saved = !!savedRow.read_only
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, read_only: saved } : u)))
    }
    setUpdatingId(null)
  }

  function startEditUser(u: UserRow) {
    setEditingUserId(u.id)
    setEditEmail(u.email)
    setEditName(u.name)
    setEditEstimatorProspectsAccess(u.role === 'estimator' && !!u.estimator_prospects_access)
    setEditTeamProspectsAccess(!!u.team_prospects_access)
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
    setEditTeamProspectsAccess(false)
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
      team_prospects_access?: boolean
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
    if (updates.team_prospects_access !== undefined) {
      updatePayload.team_prospects_access = updates.team_prospects_access
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
              ...(updates.team_prospects_access !== undefined ? { team_prospects_access: updates.team_prospects_access } : {}),
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
      team_prospects_access?: boolean
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
    if (editingUser && ['dev', 'master_technician', 'assistant', 'estimator'].includes(editingUser.role)) {
      updates.team_prospects_access = editTeamProspectsAccess
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
    setEditTeamProspectsAccess(false)
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
    setInviteRole('')
    setInviteTraining(false)
    setInviteName('')
    setInviteServiceTypeIds([])
    setInviteError(null)
  }

  function closeInvite() {
    setInviteOpen(false)
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!roleChosen(inviteRole) || !inviteFormValid({ email: inviteEmail, role: inviteRole })) {
      setInviteError('Choose a role before sending the invite.')
      return
    }
    const chosenRole: UserRole = inviteRole
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
      role: chosenRole,
      name: trimmedName || undefined,
      redirectTo: `${window.location.origin}/accept-invite`,
      read_only: inviteTraining,
    }
    if (roleTakesServiceTypes(chosenRole) && inviteServiceTypeIds.length > 0) {
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
    recordNavClick(authUser?.id, authRole, 'user_invited', userCreatedTelemetryTarget(chosenRole, inviteTraining))
    closeInvite()
    await reloadAfterMutation()
  }

  function openManualAdd() {
    setManualAddOpen(true)
    setManualAddEmail('')
    setManualAddName('')
    setManualAddRole('')
    setManualAddTraining(false)
    setManualAddPassword('')
    setManualAddServiceTypeIds([])
    setManualAddError(null)
  }

  function closeManualAdd() {
    setManualAddOpen(false)
  }

  async function handleManualAdd(e: FormEvent) {
    e.preventDefault()
    if (
      !roleChosen(manualAddRole) ||
      !inviteFormValid({ email: manualAddEmail, role: manualAddRole, password: manualAddPassword, requirePassword: true })
    ) {
      setManualAddError('Choose a role before creating the account.')
      return
    }
    const chosenRole: UserRole = manualAddRole
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
        role: chosenRole,
        name: trimmedName || undefined,
        read_only: manualAddTraining,
    }
    if (roleTakesServiceTypes(chosenRole) && manualAddServiceTypeIds.length > 0) {
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
    recordNavClick(authUser?.id, authRole, 'user_created', userCreatedTelemetryTarget(chosenRole, manualAddTraining))
    closeManualAdd()
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

    const confirmed = await confirmDialog({
      message: `Convert "${masterLabel}" from master to ${roleLabel} and reassign all of their customers, projects, and people to "${newMasterLabel}"? This cannot easily be undone.`,
      confirmLabel: 'Convert',
      danger: true,
    })
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
  /** Open the unified archive dialog. With a user → row entry (heading only);
   * without → top-button entry (shows the account picker). */
  function openArchiveConfirm(u?: UserRow | null) {
    setArchiveConfirmOpen(true)
    setArchiveConfirmPicker(!u)
    setArchiveConfirmError(null)
    setArchiveReassignMode('keep')
    setArchiveReassignTargetId('')
    setArchiveConfirmUser(u ?? null)
    setArchiveConfirmCustomerCount(null)
    if (u) void loadArchiveCustomerCount(u.id)
  }

  async function loadArchiveCustomerCount(userId: string) {
    const { count } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('master_user_id', userId)
    setArchiveConfirmCustomerCount(count ?? 0)
  }

  /** Picker entry: choose (or change) which account the dialog is about. */
  function selectArchiveConfirmUser(userId: string) {
    const u = users.find((x) => x.id === userId) ?? null
    setArchiveConfirmUser(u)
    setArchiveConfirmError(null)
    setArchiveReassignMode('keep')
    setArchiveReassignTargetId('')
    setArchiveConfirmCustomerCount(null)
    if (u) void loadArchiveCustomerCount(u.id)
  }

  function closeArchiveConfirm() {
    setArchiveConfirmOpen(false)
    setArchiveConfirmUser(null)
  }

  async function handleArchiveConfirm() {
    const u = archiveConfirmUser
    if (!u) return
    const blocker = archiveChoiceBlocker({
      userSelected: true,
      customerCount: archiveConfirmCustomerCount,
      mode: archiveReassignMode,
      reassignTargetId: archiveReassignTargetId,
    })
    if (blocker) {
      setArchiveConfirmError(blocker)
      return
    }
    setArchiveConfirmError(null)
    setArchiveConfirmSubmitting(true)
    const body = archiveRequestBody(u, archiveConfirmCustomerCount, archiveReassignMode, archiveReassignTargetId)
    const { data, error: eFn } = await supabase.functions.invoke('archive-user', { body })
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
    const reassignedNote = body.reassign_customers_to
      ? ` ${archiveConfirmCustomerCount} customer${archiveConfirmCustomerCount === 1 ? '' : 's'} reassigned.`
      : ''
    showToast(`${u.name || u.email} archived.${reassignedNote}`, 'success')
    closeArchiveConfirm()
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

  /** Merge-away path for external roster people (no login): folds the person onto the
   * survivor's roster identity via the combine-people engine. The survivor gets a linked
   * people row created on the fly when it doesn't have one yet. */
  async function runExternalMerge(dryRun: boolean, personId: string) {
    const person = externalSubPeople.find((p) => p.id === personId)
    const survivor = users.find((u) => u.id === mergeSurvivorId)
    if (!person || !survivor) {
      setMergeError('Selection is stale — close and reopen Merge users.')
      return
    }
    const survivorName = (survivor.name || survivor.email).trim()
    setMergeError(null)
    setMergeSubmitting(true)
    try {
      const { data: existingRows, error: eExisting } = await supabase
        .from('people')
        .select('id, name, account_user_id')
        .eq('account_user_id', survivor.id)
        .is('archived_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
      if (eExisting) throw new Error(eExisting.message)
      const existing = existingRows?.[0] ?? null

      if (dryRun) {
        if (!existing) {
          // No roster row to fold into — the merge is a pure account link (see below).
          setMergePreview({
            moved: {},
            warnings: [
              `${survivorName} has no roster person row yet, so "${person.name}" will simply be linked to the account as its roster entry. Their hours, pay records, crew records, and sub sheets already follow this person — nothing needs to move, and nothing is archived.`,
            ],
          })
          return
        }
        const p = await previewCombinePeople(person.id, person.name)
        const moved: Record<string, number> = {}
        for (const line of p.lines) {
          const n = Math.max(line.nameRows, line.idRows)
          if (n > 0) moved[line.table] = n
        }
        if (p.laborSheets > 0) moved['sub sheets (assigned names)'] = p.laborSheets
        const warnings = [
          `"${person.name}" is an external roster person (no login) — their hours, pay records, crew records, and sub sheets fold onto ${survivorName}'s roster identity, then the external row is archived (never deleted). Login accounts are not touched.`,
        ]
        setMergePreview({ moved, warnings })
        return
      }

      if (!existing) {
        // Link, don't insert: RLS only lets you INSERT people rows you own, but devs can
        // UPDATE any row — and linking is the correct semantic anyway (the external row
        // becomes the account's roster entry; its records already follow it).
        const { error: eLink } = await supabase
          .from('people')
          .update({ account_user_id: survivor.id })
          .eq('id', person.id)
        if (eLink) throw new Error(`link ${person.name} to ${survivorName}: ${eLink.message}`)
        showToast(`Linked ${person.name} to ${survivorName}'s account as its roster entry.`, 'success')
        setMergeOpen(false)
        await reloadAfterMutation()
        return
      }

      const result = await executeCombinePeople({
        source: { id: person.id, name: person.name, account_user_id: null },
        target: { id: existing.id, name: existing.name, account_user_id: existing.account_user_id },
      })
      showToast(
        `Merged ${person.name} into ${survivorName}: ${result.renamedRows} rows renamed, ${result.repointedRows} repointed, ${result.sheetsRewritten} sheets updated. External row archived.`,
        'success',
      )
      setMergeOpen(false)
      await reloadAfterMutation()
    } catch (e) {
      setMergeError(formatErrorMessage(e, 'Merge failed'))
    } finally {
      setMergeSubmitting(false)
    }
  }

  async function runMerge(dryRun: boolean) {
    if (!mergeSurvivorId || !mergeAbsorbedId) {
      setMergeError('Pick both accounts.')
      return
    }
    if (mergeAbsorbedId.startsWith(EXTERNAL_MERGE_OPTION_PREFIX)) {
      await runExternalMerge(dryRun, mergeAbsorbedId.slice(EXTERNAL_MERGE_OPTION_PREFIX.length))
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

  return {
    /** Signed-in user's id — the panel hides the read-only toggle on your own row (the DB refuses it too). */
    currentUserId: authUser?.id ?? null,
    users,
    setUsers,
    ctSeatByUserId,
    creatingCtSeatId,
    handleCreateCtSeat,
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
    inviteTraining,
    setInviteTraining,
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
    manualAddTraining,
    setManualAddTraining,
    manualAddPassword,
    setManualAddPassword,
    manualAddServiceTypeIds,
    setManualAddServiceTypeIds,
    manualAddError,
    setManualAddError,
    manualAddSubmitting,
    setManualAddSubmitting,
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
    editTeamProspectsAccess,
    setEditTeamProspectsAccess,
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
    archiveConfirmOpen,
    archiveConfirmPicker,
    archiveConfirmUser,
    archiveConfirmSubmitting,
    archiveConfirmError,
    archiveConfirmCustomerCount,
    archiveReassignMode,
    setArchiveReassignMode,
    archiveReassignTargetId,
    setArchiveReassignTargetId,
    selectArchiveConfirmUser,
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
    externalSubPeople,
    openMerge,
    closeMerge,
    runMerge,
    handleRestore,
    closeSetPassword,
    handleSetPassword,
    checkDuplicateName,
    handleConvertMaster,
    loadArchivedUsers,
    loadServiceTypes,
  }
}
