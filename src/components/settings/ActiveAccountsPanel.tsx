/** Active Accounts management panel: users table (copy cells, service-type pills,
 * role select, last login), invite / manual add / unified archive (with optional
 * customer reassignment) / set-password satellite modals, archived-users restore,
 * and convert-master.
 * State + handlers live in useActiveAccountsManagement; this renders in two
 * surfaces: inline card on Settings → People & accounts, and inside the
 * app-level Active Accounts modal (ActiveAccountsModalContext). */
import React from 'react'
import type { UserRole } from '../../hooks/useAuth'
import type { UserRow } from '../../types/settingsRows'
import { ROLES } from '../../lib/userRoles'
import { humanRoleLabel } from '../../lib/roleLabels'
import { inviteFormValid, roleTakesServiceTypes, type RoleChoice } from '../../lib/inviteUserForm'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { eligibleAbsorbCandidates, eligibleExternalAbsorbCandidates, EXTERNAL_MERGE_OPTION_PREFIX } from '../../lib/mergeUserAccounts'
import { archiveChoiceBlocker, eligibleReassignTargets } from '../../lib/archiveUserDialog'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { filterActiveAccountUsers } from '../../lib/activeAccountsSearch'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import PasswordInput from '../PasswordInput'
import { useActiveAccountsManagement } from '../../hooks/useActiveAccountsManagement'

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

function serviceTypeIdsForUser(u: UserRow): string[] | null {
  if (u.role === 'estimator') return u.estimator_service_type_ids ?? []
  if (u.role === 'primary') return u.primary_service_type_ids ?? []
  if (u.role === 'superintendent') return u.superintendent_service_type_ids ?? []
  if (u.role === 'subcontractor') return u.subcontractor_service_type_ids ?? []
  if (u.role === 'helpers') return u.helpers_service_type_ids ?? []
  return null
}

type ActiveAccountsPanelProps = {
  variant: 'card' | 'modal'
  onDataChanged?: () => void
  onOpenFindDuplicates?: () => void
}

export default function ActiveAccountsPanel({ variant, onDataChanged, onOpenFindDuplicates }: ActiveAccountsPanelProps) {
  const { showToast } = useToastContext()
  const {
    users,
    error,
    updatingId,
    ctSeatByUserId,
    creatingCtSeatId,
    handleCreateCtSeat,
    serviceTypes,
    archivedUsers,
    inviteOpen,
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
    inviteServiceTypeIds,
    setInviteServiceTypeIds,
    manualAddOpen,
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
    archiveConfirmOpen,
    archiveConfirmPicker,
    archiveReassignMode,
    setArchiveReassignMode,
    archiveReassignTargetId,
    setArchiveReassignTargetId,
    selectArchiveConfirmUser,
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
    externalSubPeople,
    openMerge,
    closeMerge,
    runMerge,
    restoreSubmitting,
    restoreError,
    restoringUserId,
    sendingSignInEmailId,
    setPasswordUser,
    setSetPasswordUser,
    setPasswordValue,
    setSetPasswordValue,
    setPasswordConfirm,
    setSetPasswordConfirm,
    setPasswordSubmitting,
    setPasswordError,
    setSetPasswordError,
    editingUserId,
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
    convertMasterId,
    setConvertMasterId,
    convertNewMasterId,
    setConvertNewMasterId,
    convertNewRole,
    setConvertNewRole,
    convertAutoAdopt,
    setConvertAutoAdopt,
    convertSubmitting,
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
    currentUserId,
    startEditUser,
    cancelEditUser,
    saveUserEdits,
    sendSignInEmail,
    openInvite,
    closeInvite,
    handleInvite,
    openManualAdd,
    closeManualAdd,
    handleManualAdd,
    handleRestore,
    closeSetPassword,
    handleSetPassword,
    handleConvertMaster,
  } = useActiveAccountsManagement({ enabled: true, onDataChanged })

  const [searchQuery, setSearchQuery] = React.useState('')
  // Digital twins Phase T1: flagged accounts get a 🤖 chip. Separate fail-soft fetch —
  // users.is_digital_twin may not be deployed yet (empty set = no chips, never an error).
  const [twinIds, setTwinIds] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await (supabase as never as {
          from: (t: string) => { select: (c: string) => { eq: (k: string, v: boolean) => Promise<{ data: { id: string }[] | null; error: unknown }> } }
        })
          .from('users')
          .select('id')
          .eq('is_digital_twin', true)
        if (cancelled || error) return
        setTwinIds(new Set((data ?? []).map((r) => r.id)))
      } catch {
        /* column not deployed yet */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  const visibleUsers = filterActiveAccountUsers(users, searchQuery)
  const visibleArchivedUsers = filterActiveAccountUsers(archivedUsers, searchQuery)

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`Copied ${text}`, 'success')
    } catch {
      showToast('Could not copy to clipboard', 'error')
    }
  }

  return (
    <>
          <div className="activeAccountsCard" style={variant === 'modal' ? { marginBottom: 0, border: 'none', boxShadow: 'none' } : undefined}>
            {variant === 'card' && (
            <button
              type="button"
              onClick={() => setActiveAccountsSectionOpen((prev) => !prev)}
              className="activeAccountsCard__toggle"
            >
              <span className="activeAccountsCard__chevron">{activeAccountsSectionOpen ? '▼' : '▶'}</span>
              Active Accounts
            </button>
            )}
            {(variant === 'modal' || activeAccountsSectionOpen) && (
            <div className="activeAccountsCard__body" style={variant === 'modal' ? { borderTop: 'none' } : undefined}>
          {variant === 'modal' && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                background: 'var(--surface)',
                padding: '0.75rem 0 0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, or role…"
                aria-label="Search accounts"
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: '0.9375rem',
                  background: 'var(--surface)',
                  color: 'inherit',
                }}
              />
            </div>
          )}
          {variant === 'card' && (
            <p className="activeAccountsCard__desc">
              Set user class for everyone who has signed up. Only owners can change these.
            </p>
          )}
          <div className="activeAccountsCard__actions">
            <button type="button" onClick={openInvite} className="activeAccountsCard__btnPrimary">
              Invite via email
            </button>
            <button type="button" onClick={openManualAdd} className="activeAccountsCard__btnSecondary">
              Manually add user
            </button>
            <button type="button" onClick={() => openArchiveConfirm()} className="activeAccountsCard__btnDanger">
              Archive user
            </button>
            <button type="button" onClick={openMerge} className="activeAccountsCard__btnDanger">
              Merge users
            </button>
          </div>
          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table className="activeAccountsCard__table">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Service types / Role</th>
                  <th className="activeAccountsCard__lastLogin">Last login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <React.Fragment key={u.id}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {editingUserId === u.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Name"
                            style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                          />
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="Email"
                            style={{ width: '100%', padding: '0.25rem 0.5rem' }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          {twinIds.has(u.id) ? (
                            <span
                              title="Digital twin — agent-operated account (docs/DIGITAL_TWINS_PLAN.md); activity tracked separately from people"
                              style={{ fontSize: '0.66rem', fontWeight: 700, borderRadius: 999, padding: '0.08rem 0.5rem', background: 'var(--bg-violet-100)', color: 'var(--text-violet-800)', border: '1px solid var(--border-violet)', whiteSpace: 'nowrap' }}
                            >
                              🤖 digital twin
                            </span>
                          ) : null}
                          {u.name ? (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(u.name ?? '')}
                              title="Click to copy name"
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                            >
                              {u.name}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-faint)' }}>—</span>
                          )}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.email)}
                            title="Click to copy email"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', color: 'var(--text-muted)' }}
                          >
                            {u.email}
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', fontSize: '0.875rem' }}>
                          {(() => {
                            const ids = serviceTypeIdsForUser(u)
                            if (ids === null) return <span style={{ color: 'var(--text-faint)' }}>—</span>
                            if (ids.length === 0) return <span>All</span>
                            const pills = ids
                              .map((id) => serviceTypes.find((st) => st.id === id)?.name)
                              .filter((n): n is string => Boolean(n))
                              .map((name) => buildServiceTypeTradePill(name))
                              .filter((pill): pill is NonNullable<typeof pill> => pill !== null)
                            if (pills.length === 0) return <span style={{ color: 'var(--text-faint)' }}>—</span>
                            return pills.map((pill) => (
                              <span key={pill.label} style={pill.style}>{pill.label}</span>
                            ))
                          })()}
                        </div>
                        <select
                          value={u.role}
                          onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                          disabled={updatingId === u.id}
                          className="activeAccountsCard__select"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {humanRoleLabel(r)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="activeAccountsCard__lastLogin">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                        <span>{timeSinceAgo(u.last_sign_in_at)}</span>
                        {u.id === currentUserId ? (
                          <span
                            title="You cannot put your own account in read-only mode — a read-only user cannot undo it, so ask another dev."
                            style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', color: 'var(--text-faint)' }}
                          >
                            Read-only n/a
                          </span>
                        ) : (
                          <label
                            title="Training mode: they can browse everything their role can see, but every change is blocked. Works for any role."
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem', whiteSpace: 'nowrap', color: u.read_only ? 'var(--text-amber-700)' : 'var(--text-muted)' }}
                          >
                            <input
                              type="checkbox"
                              checked={!!u.read_only}
                              disabled={updatingId === u.id}
                              onChange={(e) => updateReadOnly(u.id, e.target.checked)}
                            />
                            Read-only
                          </label>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0.375rem', alignItems: 'center' }}>
                          {editingUserId === u.id ? (
                            <>
                              <button
                                type="button"
                                onClick={saveUserEdits}
                                disabled={updatingId === u.id}
                                className="activeAccountsCard__rowBtnPrimary"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditUser}
                                disabled={updatingId === u.id}
                                className="activeAccountsCard__rowBtn"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditUser(u)}
                              className="activeAccountsCard__rowBtn"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSetPasswordUser(u)
                              setSetPasswordValue('')
                              setSetPasswordConfirm('')
                              setSetPasswordError(null)
                            }}
                            disabled={setPasswordSubmitting}
                            className="activeAccountsCard__rowBtn"
                          >
                            Set password
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => sendSignInEmail(u)}
                          disabled={sendingSignInEmailId === u.id}
                          className="activeAccountsCard__rowBtn"
                        >
                          {sendingSignInEmailId === u.id ? 'Sending…' : 'Send email to sign in'}
                        </button>
                        {editingUserId === u.id && ctSeatByUserId !== null && (
                          ctSeatByUserId[u.id] ? (
                            <span
                              style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-green-800)' }}
                              title={`CountTooling seat linked — CT uuid ${ctSeatByUserId[u.id]}. Archiving this account also retires the CT seat.`}
                            >
                              CT seat ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleCreateCtSeat(u)}
                              disabled={creatingCtSeatId === u.id}
                              className="activeAccountsCard__rowBtn"
                              title="Create (or find) this person’s CountTooling account over the bridge and link it"
                            >
                              {creatingCtSeatId === u.id ? 'Creating…' : 'Create CountTooling seat'}
                            </button>
                          )
                        )}
                        {editingUserId === u.id && (
                          <button
                            type="button"
                            onClick={() => openArchiveConfirm(u)}
                            disabled={archiveConfirmSubmitting}
                            className="activeAccountsCard__rowBtn"
                            style={{ color: 'var(--text-red-700)', borderColor: '#fecaca' }}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingUserId === u.id && u.role === 'estimator' && (
                    <tr key={`${u.id}-service-types`} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Materials)</div>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict.</p>
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
                  {editingUserId === u.id && ['dev', 'master_technician', 'assistant', 'estimator'].includes(u.role) && (
                    <tr key={`${u.id}-team-prospects`} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                          <input
                            type="checkbox"
                            checked={editTeamProspectsAccess}
                            onChange={(e) => setEditTeamProspectsAccess(e.target.checked)}
                            disabled={updatingId === u.id}
                          />
                          Can see Prospects → Hiring (the hiring board)
                        </label>
                      </td>
                    </tr>
                  )}
                  {editingUserId === u.id && u.role === 'primary' && (
                    <tr key={`${u.id}-primary-service-types`} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Materials)</div>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict.</p>
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
                    <tr key={`${u.id}-superintendent-service-types`} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Materials, Bids)</div>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict.</p>
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
                  {editingUserId === u.id && isSubcontractorLikeRole(u.role) && (
                    <tr key={`${u.id}-subcontractor-service-types`} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <div style={{ marginBottom: 4, fontWeight: 500 }}>Service types (Clock In, Dispatch)</div>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>Leave unchecked for access to all. Select specific types to restrict job/bid association.</p>
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
            <p style={{ color: 'var(--text-red-700)', marginTop: '0.5rem' }}>
              {editError}
            </p>
          )}
          {users.length === 0 && <p style={{ marginTop: '1rem' }}>No users yet.</p>}
          {users.length > 0 && visibleUsers.length === 0 && (
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No accounts match “{searchQuery.trim()}”.</p>
          )}

          {/* Archived users */}
          <div style={{ marginTop: '2rem', border: '1px solid var(--border)', borderRadius: '0.5rem', maxWidth: 640 }}>
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
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                {restoreError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{restoreError}</p>}
                {archivedUsers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No archived users.</p>
                ) : visibleArchivedUsers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No archived users match “{searchQuery.trim()}”.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Archived</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleArchivedUsers.map((u) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
            <div style={{ marginTop: '2rem', border: '1px solid var(--border)', borderRadius: '0.5rem', maxWidth: 640 }}>
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
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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
                <p style={{ marginBottom: '0.75rem', color: 'var(--text-amber-700)', fontSize: '0.8125rem' }}>
                  This operation reassigns all customers, projects, and people owned by the selected master to the new master and
                  changes their role. It is not easily reversible.
                </p>
                {convertError && <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem' }}>{convertError}</p>}
                {convertSummary && <p style={{ color: 'var(--text-green-600)', marginBottom: '0.75rem' }}>{convertSummary}</p>}
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
            {onOpenFindDuplicates && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                Roster of Assistants, Masters, and Subcontractors. You can add people who have not signed up. Use these when assigning workflow steps.
              </p>
              <button
                type="button"
                onClick={onOpenFindDuplicates}
                style={{ padding: '0.35rem 0.75rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Find duplicates
              </button>
            </div>
            )}
            </div>
            )}
          </div>


      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
                <label htmlFor="invite-role" style={{ display: 'block', marginBottom: 4 }}>Role *</label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => { setInviteRole(e.target.value as RoleChoice); setInviteError(null) }}
                  required
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="" disabled>Choose a role…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{humanRoleLabel(r)}</option>
                  ))}
                </select>
              </div>
              {roleTakesServiceTypes(inviteRole) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>Service types (optional)</label>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>{inviteRole === 'estimator' ? 'Leave unchecked for access to all service types. Select specific types to restrict.' : 'Leave unchecked for access to all. Select specific types to restrict job/bid association in Clock In and Dispatch.'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                    {serviceTypes.map((st) => (
                      <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={inviteServiceTypeIds.includes(st.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteServiceTypeIds((prev) => [...prev, st.id])
                            } else {
                              setInviteServiceTypeIds((prev) => prev.filter((id) => id !== st.id))
                            }
                          }}
                          disabled={inviteSubmitting}
                        />
                        {st.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={inviteTraining}
                    onChange={(e) => setInviteTraining(e.target.checked)}
                    disabled={inviteSubmitting}
                  />
                  Start in training mode (read-only)
                </label>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 1.5rem' }}>They can browse everything their role sees, but every change is blocked until a dev switches it off. Clocking in and out still works.</p>
              </div>
              {inviteError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{inviteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={inviteSubmitting || !inviteFormValid({ email: inviteEmail, role: inviteRole })}
                  title={inviteRole === '' ? 'Choose a role first' : undefined}
                >
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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
                <label htmlFor="manual-role" style={{ display: 'block', marginBottom: 4 }}>Role *</label>
                <select
                  id="manual-role"
                  value={manualAddRole}
                  onChange={(e) => { setManualAddRole(e.target.value as RoleChoice); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="" disabled>Choose a role…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{humanRoleLabel(r)}</option>
                  ))}
                </select>
              </div>
              {roleTakesServiceTypes(manualAddRole) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>Service types (optional)</label>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 6 }}>{manualAddRole === 'estimator' ? 'Leave unchecked for access to all service types. Select specific types to restrict.' : 'Leave unchecked for access to all. Select specific types to restrict job/bid association in Clock In and Dispatch.'}</p>
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
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={manualAddTraining}
                    onChange={(e) => setManualAddTraining(e.target.checked)}
                    disabled={manualAddSubmitting}
                  />
                  Start in training mode (read-only)
                </label>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 1.5rem' }}>They can browse everything their role sees, but every change is blocked until a dev switches it off. Clocking in and out still works.</p>
              </div>
              {manualAddError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{manualAddError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={
                    manualAddSubmitting ||
                    !inviteFormValid({ email: manualAddEmail, role: manualAddRole, password: manualAddPassword, requirePassword: true })
                  }
                  title={manualAddRole === '' ? 'Choose a role first' : undefined}
                >
                  {manualAddSubmitting ? 'Creating…' : 'Create user'}
                </button>
                <button type="button" onClick={closeManualAdd} disabled={manualAddSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {archiveConfirmOpen && (() => {
        const blocker = archiveChoiceBlocker({
          userSelected: archiveConfirmUser != null,
          customerCount: archiveConfirmCustomerCount,
          mode: archiveReassignMode,
          reassignTargetId: archiveReassignTargetId,
        })
        const willReassign =
          archiveConfirmCustomerCount != null && archiveConfirmCustomerCount > 0 && archiveReassignMode === 'reassign'
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480 }}>
            <h2 style={{ marginTop: 0 }}>
              {archiveConfirmUser
                ? `Archive ${archiveConfirmUser.name || archiveConfirmUser.email}?`
                : 'Archive user'}
            </h2>
            {archiveConfirmPicker && (
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="archive-user-select" style={{ display: 'block', marginBottom: 4 }}>
                  Account to archive *
                </label>
                <select
                  id="archive-user-select"
                  value={archiveConfirmUser?.id ?? ''}
                  onChange={(e) => selectArchiveConfirmUser(e.target.value)}
                  disabled={archiveConfirmSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select account…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {archiveConfirmUser && (
              <>
                <p style={{ color: 'var(--text-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  Are you sure? Archiving <strong>{archiveConfirmUser.email}</strong> means:
                </p>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.2rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                  <li>They can no longer sign in (their login is banned).</li>
                  <li>They disappear from active-account lists and assignment pickers.</li>
                  <li>
                    Nothing is deleted — their jobs, clock time, reports, and history stay attached to
                    the account.
                  </li>
                  <li>You can restore them anytime from the Archived users section.</li>
                </ul>
                {archiveConfirmCustomerCount == null && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Counting customers…</p>
                )}
                {archiveConfirmCustomerCount != null && archiveConfirmCustomerCount > 0 && (
                  <div
                    style={{
                      background: 'var(--bg-amber-100)',
                      border: '1px solid #f59e0b',
                      padding: '0.75rem',
                      borderRadius: 4,
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    <p style={{ margin: '0 0 0.5rem' }}>
                      ⚠️ This user owns <strong>{archiveConfirmCustomerCount}</strong> customer
                      {archiveConfirmCustomerCount !== 1 ? 's' : ''}. What should happen to them?
                    </p>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', cursor: 'pointer', marginBottom: '0.35rem' }}>
                      <input
                        type="radio"
                        name="archive-customers"
                        checked={archiveReassignMode === 'keep'}
                        onChange={() => setArchiveReassignMode('keep')}
                        disabled={archiveConfirmSubmitting}
                        style={{ marginTop: 2 }}
                      />
                      <span>Keep them assigned to the archived account</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="archive-customers"
                        checked={archiveReassignMode === 'reassign'}
                        onChange={() => setArchiveReassignMode('reassign')}
                        disabled={archiveConfirmSubmitting}
                        style={{ marginTop: 2 }}
                      />
                      <span>Reassign them to another master</span>
                    </label>
                    {archiveReassignMode === 'reassign' && (
                      <select
                        aria-label="New master for customers"
                        value={archiveReassignTargetId}
                        onChange={(e) => setArchiveReassignTargetId(e.target.value)}
                        disabled={archiveConfirmSubmitting}
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                      >
                        <option value="">Select new master…</option>
                        {eligibleReassignTargets(users, archiveConfirmUser.id).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email} ({u.email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </>
            )}
            {archiveConfirmError && (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{archiveConfirmError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => void handleArchiveConfirm()}
                disabled={archiveConfirmSubmitting || blocker != null}
                title={blocker ?? undefined}
                style={{
                  padding: '0.5rem 1rem',
                  background: archiveConfirmSubmitting || blocker != null ? '#fca5a5' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: archiveConfirmSubmitting || blocker != null ? 'not-allowed' : 'pointer',
                }}
              >
                {archiveConfirmSubmitting ? 'Archiving…' : willReassign ? 'Reassign & archive' : 'Archive user'}
              </button>
              <button
                type="button"
                onClick={closeArchiveConfirm}
                disabled={archiveConfirmSubmitting}
                style={{ padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {mergeOpen && (() => {
        const allAccounts = [...users, ...archivedUsers]
        const survivor = allAccounts.find((u) => u.id === mergeSurvivorId) ?? null
        const absorbCandidates = eligibleAbsorbCandidates(survivor, allAccounts)
        const externalCandidates = eligibleExternalAbsorbCandidates(survivor, externalSubPeople)
        const accountLabel = (u: UserRow) =>
          `${u.name || u.email} (${u.email})${u.archived_at ? ' — archived' : ''}`
        const movedEntries = mergePreview ? Object.entries(mergePreview.moved) : []
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 540, maxHeight: '85vh', overflow: 'auto' }}>
              <h2 style={{ marginTop: 0 }}>Merge users</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Moves everything the merged-away account owns (clock time, reports, job and bid
                assignments, notes, banking attributions…) onto the account you keep, then leaves
                the merged-away account archived and banned. Both accounts must have the same
                role, and the merged-away account must be archived or never signed into. When the
                kept account is a subcontractor, external subcontractors (roster rows with no
                login) can also be merged away — their hours, crew records, and sub sheets fold
                onto the kept account&apos;s roster identity.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="merge-survivor" style={{ display: 'block', marginBottom: 4 }}>
                  Keep this account *
                </label>
                <select
                  id="merge-survivor"
                  value={mergeSurvivorId}
                  onChange={(e) => {
                    setMergeSurvivorId(e.target.value)
                    setMergeAbsorbedId('')
                    setMergeError(null)
                    setMergePreview(null)
                  }}
                  disabled={mergeSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Select account…</option>
                  {allAccounts.map((u) => (
                    <option key={u.id} value={u.id}>
                      {accountLabel(u)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="merge-absorbed" style={{ display: 'block', marginBottom: 4 }}>
                  Merge this account away *
                </label>
                <select
                  id="merge-absorbed"
                  value={mergeAbsorbedId}
                  onChange={(e) => {
                    setMergeAbsorbedId(e.target.value)
                    setMergeError(null)
                    setMergePreview(null)
                  }}
                  disabled={mergeSubmitting || !mergeSurvivorId}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">
                    {mergeSurvivorId ? 'Select account…' : 'Pick the account to keep first…'}
                  </option>
                  {absorbCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {accountLabel(u)}
                    </option>
                  ))}
                  {externalCandidates.map((p) => (
                    <option key={p.id} value={`${EXTERNAL_MERGE_OPTION_PREFIX}${p.id}`}>
                      {p.name} — external subcontractor
                    </option>
                  ))}
                </select>
                {mergeSurvivorId && absorbCandidates.length === 0 && externalCandidates.length === 0 && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    No eligible accounts: same role, and archived or never signed into.
                  </p>
                )}
              </div>
              {mergePreview && (
                <div
                  style={{
                    background: 'var(--bg-amber-tint)',
                    border: '1px solid #f59e0b',
                    borderRadius: 4,
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                    Preview — this merge would move:
                  </div>
                  {movedEntries.length === 0 ? (
                    <div>No data rows — only the account itself is affected.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {movedEntries.map(([k, n]) => (
                        <li key={k}>
                          {k}: <strong>{n}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  {mergePreview.warnings.map((w, i) => (
                    <p key={i} style={{ margin: '0.5rem 0 0', color: 'var(--text-amber-800)' }}>
                      ⚠️ {w}
                    </p>
                  ))}
                  <p style={{ margin: '0.5rem 0 0', fontWeight: 600, color: 'var(--text-red-700)' }}>
                    Merging cannot be undone.
                  </p>
                </div>
              )}
              {mergeError && <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{mergeError}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void runMerge(true)}
                  disabled={mergeSubmitting || !mergeSurvivorId || !mergeAbsorbedId}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  {mergeSubmitting && !mergePreview ? 'Previewing…' : 'Preview merge'}
                </button>
                <button
                  type="button"
                  onClick={() => void runMerge(false)}
                  disabled={mergeSubmitting || !mergePreview}
                  title={mergePreview ? undefined : 'Run Preview merge first'}
                  style={{
                    padding: '0.5rem 1rem',
                    background: mergePreview ? '#dc2626' : '#fca5a5',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: mergePreview ? 'pointer' : 'not-allowed',
                  }}
                >
                  {mergeSubmitting && mergePreview ? 'Merging…' : 'Merge now'}
                </button>
                <button type="button" onClick={closeMerge} disabled={mergeSubmitting} style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {setPasswordUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
              {setPasswordError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{setPasswordError}</p>}
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
    </>
  )
}
