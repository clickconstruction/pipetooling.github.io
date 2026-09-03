import { useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useActiveAccountsModal } from '../../../contexts/ActiveAccountsModalContext'
import { canArchiveAccount, canEditAccount, canSetTrainingMode, type PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { describeLastSeen } from '../../../lib/people/personKey'
import type { PersonDeskUserRow } from '../../../hooks/usePersonDesk'
import { BTN, BTN_QUIET, BTN_RED, Chip, DeskEmpty, DeskRow, DeskSection, LockTag, deskBtn } from '../personDeskShared'
import type { UserRole } from '../../../hooks/useAuth'

const ROLES: Array<{ value: string; label: string }> = [
  { value: 'helpers', label: 'Helper' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'controller', label: 'Controller' },
  { value: 'estimator', label: 'Estimator' },
  { value: 'master_technician', label: 'Master' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'primary', label: 'Primary' },
  { value: 'dev', label: 'Dev' },
]

async function fnErrorMessage(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return e instanceof Error ? e.message : 'That did not save'
}

export function PersonDeskAccessSection({
  user,
  viewer,
  viewerUserId,
  serviceTypeNames,
  onChanged,
}: {
  user: PersonDeskUserRow | null
  viewer: PersonDeskViewer
  viewerUserId: string | null
  serviceTypeNames: Map<string, string>
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const accountsModal = useActiveAccountsModal()
  const [busy, setBusy] = useState<string | null>(null)

  if (!user) {
    return (
      <DeskSection title="Access & account">
        <DeskEmpty>No login account. The header's "Invite as user" note says where to invite them.</DeskEmpty>
      </DeskSection>
    )
  }

  const editable = canEditAccount(viewer)
  const isSelf = viewerUserId === user.id
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label ?? user.role ?? '—'
  const serviceIds =
    user.role === 'estimator'
      ? user.estimator_service_type_ids
      : user.role === 'primary'
        ? user.primary_service_type_ids
        : user.role === 'superintendent'
          ? user.superintendent_service_type_ids
          : user.role === 'subcontractor'
            ? user.subcontractor_service_type_ids
            : user.role === 'helpers'
              ? user.helpers_service_type_ids
              : null

  async function setRole(role: string) {
    if (!editable || !user) return
    const ok = await confirmDialog({ message: `Change ${user.name ?? user.email}'s role to ${ROLES.find((r) => r.value === role)?.label ?? role}? Their navigation and access change on next load.`, confirmLabel: 'Change role' })
    if (!ok) return
    setBusy('role')
    const { error } = await supabase.from('users').update({ role: role as Exclude<UserRole, 'controller'> }).eq('id', user.id)
    setBusy(null)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Role changed', 'success')
      onChanged()
    }
  }

  async function setTraining(on: boolean) {
    if (!user) return
    setBusy('training')
    const { data, error } = await supabase.from('users').update({ read_only: on }).eq('id', user.id).select('id, read_only')
    setBusy(null)
    if (error) showToast(error.message, 'error')
    else if (!data?.[0]) showToast('That change did not apply — you may not have permission to change this account.', 'error')
    else {
      showToast(on ? 'Training mode on — every write is blocked for them' : 'Training mode off', 'success')
      onChanged()
    }
  }

  async function sendSignIn() {
    if (!user?.email) return
    setBusy('signin')
    try {
      const redirectTo = new URL('dashboard', window.location.href).href
      const { data, error } = await supabase.functions.invoke('send-sign-in-email', { body: { email: user.email, redirectTo } })
      if (error) throw error
      const err = (data as { error?: string } | null)?.error
      if (err) throw new Error(err)
      showToast(`Sign-in email sent to ${user.email}`, 'success')
    } catch (e) {
      showToast(await fnErrorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function restore() {
    if (!user) return
    setBusy('restore')
    try {
      const { data, error } = await supabase.functions.invoke('restore-user', { body: { user_id: user.id } })
      if (error) throw error
      const err = (data as { error?: string } | null)?.error
      if (err) throw new Error(err)
      showToast('Account restored', 'success')
      onChanged()
    } catch (e) {
      showToast(await fnErrorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <DeskSection title="Access & account" who={editable ? undefined : 'locked rows say why'} whoTone="dev">
      <DeskRow
        label="Role"
        actions={editable ? null : <LockTag />}
      >
        {editable ? (
          <select value={user.role ?? ''} disabled={busy != null || isSelf} onChange={(e) => void setRole(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.1rem 0.3rem' }} aria-label="Role">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <span>{roleLabel}</span>
        )}
        {(serviceIds ?? []).map((id) => (
          <Chip key={id} tone="gray">
            {serviceTypeNames.get(id) ?? 'trade'}
          </Chip>
        ))}
      </DeskRow>
      <DeskRow
        label="Sign-in"
        actions={
          editable ? (
            <>
              <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => void sendSignIn()}>
                {busy === 'signin' ? 'Sending…' : 'Send sign-in email'}
              </button>
              <button type="button" style={BTN_QUIET} onClick={() => accountsModal?.openActiveAccounts({ onDataChanged: onChanged })} title="Set password, edit name or email, merge — the full Active Accounts row">
                Manage account…
              </button>
            </>
          ) : (
            <LockTag />
          )
        }
      >
        {user.email ?? 'no email'} · {describeLastSeen(user.last_sign_in_at, Date.now())}
      </DeskRow>
      <DeskRow label="Training mode" actions={canSetTrainingMode(viewer) && !isSelf ? null : <LockTag title={isSelf ? 'You cannot flag your own account.' : undefined} />}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: canSetTrainingMode(viewer) && !isSelf ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={Boolean(user.read_only)} disabled={!canSetTrainingMode(viewer) || isSelf || busy != null} onChange={(e) => void setTraining(e.target.checked)} />
          Read-only{user.read_only ? ' — every write is blocked for them' : ''}
        </label>
      </DeskRow>
      <DeskRow
        label="Status"
        actions={
          canArchiveAccount(viewer) && !isSelf ? (
            user.archived_at ? (
              <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => void restore()}>
                {busy === 'restore' ? 'Restoring…' : 'Restore'}
              </button>
            ) : (
              <button type="button" style={BTN_RED} onClick={() => accountsModal?.openActiveAccounts({ onDataChanged: onChanged })} title="Archive runs through the Active Accounts row so customers can be reassigned on the way out">
                Archive…
              </button>
            )
          ) : (
            <LockTag />
          )
        }
      >
        {user.archived_at ? <Chip tone="gray">Archived</Chip> : <Chip tone="green">Active</Chip>}
      </DeskRow>
    </DeskSection>
  )
}
