/** Settings → People & accounts tab (dev content): active accounts, role/access management,
 * service-type group memberships, archived accounts, non-user people, convert-master, set-password,
 * and the page-access reference table.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props. */
import React, { type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import { displayLabelForUserRole } from '../../lib/userRoleDisplay'
import { isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { ROLES } from '../../lib/userRoles'
import type { PersonRow, ServiceType, UserRow } from '../../types/settingsRows'
import TeamFeedbackDevSettingsBlock from '../team-feedback/TeamFeedbackDevSettingsBlock'
import { useToastContext } from '../../contexts/ToastContext'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'

type PageAccessRow = {
  page: string
  dev: string
  master: string
  assistant: string
  sub: string
  helpers: string
  estimator: string
  primary: string
  superintendent: string
}

const PAGE_ACCESS: PageAccessRow[] = [
  { page: 'Dashboard', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'yes', helpers: 'yes', estimator: 'yes', primary: 'yes', superintendent: 'yes' },
  { page: 'Customers', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', helpers: 'no', estimator: 'yes limited', primary: 'no', superintendent: 'no' },
  { page: 'Projects', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', helpers: 'no', estimator: 'no', primary: 'no', superintendent: 'yes' },
  { page: 'Workflow', dev: 'yes', master: 'yes', assistant: 'yes limited', sub: 'no', helpers: 'no', estimator: 'no', primary: 'no', superintendent: 'yes limited' },
  { page: 'People', dev: 'yes', master: 'yes', assistant: 'yes limited', sub: 'no', helpers: 'no', estimator: 'no', primary: 'no', superintendent: 'no' },
  { page: 'Jobs', dev: 'yes', master: 'yes', assistant: 'yes limited', sub: 'no', helpers: 'no', estimator: 'no', primary: 'yes Reports only', superintendent: 'yes Stages Reports Billing Sub Ledger' },
  { page: 'Calendar', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'yes', helpers: 'yes', estimator: 'no', primary: 'yes', superintendent: 'yes' },
  { page: 'Bids', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', helpers: 'no', estimator: 'yes', primary: 'yes Bid Board, RFI, Change Order, Lien Release', superintendent: 'yes draft only' },
  { page: 'Materials', dev: 'yes', master: 'yes', assistant: 'yes', sub: 'no', helpers: 'no', estimator: 'yes', primary: 'yes', superintendent: 'yes' },
  { page: 'Templates', dev: 'yes', master: 'no', assistant: 'no', sub: 'no', helpers: 'no', estimator: 'no', primary: 'no', superintendent: 'no' },
  { page: 'Settings', dev: 'yes', master: 'yes limited', assistant: 'no', sub: 'no', helpers: 'no', estimator: 'yes limited', primary: 'yes limited', superintendent: 'yes limited' },
]

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

/** Role-appropriate service-type restriction ids: [] = access to all types, null = role has no service-type concept. */
function serviceTypeIdsForUser(u: UserRow): string[] | null {
  if (u.role === 'estimator') return u.estimator_service_type_ids ?? []
  if (u.role === 'primary') return u.primary_service_type_ids ?? []
  if (u.role === 'superintendent') return u.superintendent_service_type_ids ?? []
  if (u.role === 'subcontractor') return u.subcontractor_service_type_ids ?? []
  if (u.role === 'helpers') return u.helpers_service_type_ids ?? []
  return null
}

type SettingsPeopleTabProps = {
  activeAccountsSectionOpen: boolean
  additionalPeopleSectionOpen: boolean
  allPeopleCount: number
  archivedSectionOpen: boolean
  archivedUsers: UserRow[]
  cancelEditUser: () => void
  convertAutoAdopt: boolean
  convertError: string | null
  convertMasterId: string
  convertMasterSectionOpen: boolean
  convertNewMasterId: string
  convertNewRole: 'assistant' | 'subcontractor'
  convertSubmitting: boolean
  convertSummary: string | null
  deleteNonUserPerson: (p: PersonRow) => void
  deletingPersonId: string | null
  dispatchGroupError: string | null
  dispatchGroupSavingUserId: string | null
  dispatchMemberIds: Set<string>
  editEmail: string
  editError: string | null
  editEstimatorProspectsAccess: boolean
  editEstimatorServiceTypeIds: string[]
  editName: string
  editPersonEmail: string
  editPersonError: string | null
  editPersonName: string
  editPersonNotes: string
  editPersonPhone: string
  editPersonSaving: boolean
  editPrimaryServiceTypeIds: string[]
  editSubcontractorServiceTypeIds: string[]
  editSuperintendentServiceTypeIds: string[]
  editingNonUserPerson: PersonRow | null
  editingUserId: string | null
  error: string | null
  estimatorGroupError: string | null
  estimatorGroupSavingUserId: string | null
  estimatorInboxSectionOpen: boolean
  estimatorMemberIds: Set<string>
  handleConvertMaster: (e: FormEvent) => void
  handleRestore: (userId: string) => void
  myPeople: PersonRow[]
  nonUserPeople: PersonRow[]
  openArchive: () => void
  openArchiveReassign: () => void
  openFindDuplicatesModal: () => void
  openInvite: () => void
  openManualAdd: () => void
  payApprovedError: string | null
  payApprovedMasterIds: Set<string>
  payApprovedMasters: UserRow[]
  payApprovedMastersSectionOpen: boolean
  payApprovedSaving: boolean
  restoreError: string | null
  restoreSubmitting: boolean
  restoringUserId: string | null
  roleVisibilityExpanded: boolean
  saveNonUserPersonEdit: (e: FormEvent) => void
  saveUserEdits: () => void
  sendSignInEmail: (u: UserRow) => void
  sendingSignInEmailId: string | null
  serviceTypes: ServiceType[]
  setActiveAccountsSectionOpen: Dispatch<SetStateAction<boolean>>
  setAdditionalPeopleSectionOpen: Dispatch<SetStateAction<boolean>>
  setArchivedSectionOpen: Dispatch<SetStateAction<boolean>>
  setConvertAutoAdopt: Dispatch<SetStateAction<boolean>>
  setConvertError: Dispatch<SetStateAction<string | null>>
  setConvertMasterId: Dispatch<SetStateAction<string>>
  setConvertMasterSectionOpen: Dispatch<SetStateAction<boolean>>
  setConvertNewMasterId: Dispatch<SetStateAction<string>>
  setConvertNewRole: Dispatch<SetStateAction<'assistant' | 'subcontractor'>>
  setConvertSummary: Dispatch<SetStateAction<string | null>>
  setEditEmail: Dispatch<SetStateAction<string>>
  setEditEstimatorProspectsAccess: Dispatch<SetStateAction<boolean>>
  setEditEstimatorServiceTypeIds: Dispatch<SetStateAction<string[]>>
  setEditName: Dispatch<SetStateAction<string>>
  setEditPersonEmail: Dispatch<SetStateAction<string>>
  setEditPersonError: Dispatch<SetStateAction<string | null>>
  setEditPersonName: Dispatch<SetStateAction<string>>
  setEditPersonNotes: Dispatch<SetStateAction<string>>
  setEditPersonPhone: Dispatch<SetStateAction<string>>
  setEditPrimaryServiceTypeIds: Dispatch<SetStateAction<string[]>>
  setEditSubcontractorServiceTypeIds: Dispatch<SetStateAction<string[]>>
  setEditSuperintendentServiceTypeIds: Dispatch<SetStateAction<string[]>>
  setEditingNonUserPerson: Dispatch<SetStateAction<PersonRow | null>>
  setEstimatorInboxSectionOpen: Dispatch<SetStateAction<boolean>>
  setPasswordSubmitting: boolean
  setPayApprovedMastersSectionOpen: Dispatch<SetStateAction<boolean>>
  setRoleVisibilityExpanded: Dispatch<SetStateAction<boolean>>
  setSetPasswordConfirm: Dispatch<SetStateAction<string>>
  setSetPasswordError: Dispatch<SetStateAction<string | null>>
  setSetPasswordUser: Dispatch<SetStateAction<UserRow | null>>
  setSetPasswordValue: Dispatch<SetStateAction<string>>
  setTaskDispatchSectionOpen: Dispatch<SetStateAction<boolean>>
  startEditUser: (u: UserRow) => void
  taskDispatchSectionOpen: boolean
  toggleDispatchGroupMember: (userId: string, currentlyMember: boolean) => void
  toggleEstimatorGroupMember: (userId: string, currentlyMember: boolean) => void
  togglePayApproved: (masterId: string, isApproved: boolean) => void
  updateRole: (id: string, role: UserRole) => void
  updatingId: string | null
  users: UserRow[]
}

export default function SettingsPeopleTab({
  activeAccountsSectionOpen,
  additionalPeopleSectionOpen,
  allPeopleCount,
  archivedSectionOpen,
  archivedUsers,
  cancelEditUser,
  convertAutoAdopt,
  convertError,
  convertMasterId,
  convertMasterSectionOpen,
  convertNewMasterId,
  convertNewRole,
  convertSubmitting,
  convertSummary,
  deleteNonUserPerson,
  deletingPersonId,
  dispatchGroupError,
  dispatchGroupSavingUserId,
  dispatchMemberIds,
  editEmail,
  editError,
  editEstimatorProspectsAccess,
  editEstimatorServiceTypeIds,
  editName,
  editPersonEmail,
  editPersonError,
  editPersonName,
  editPersonNotes,
  editPersonPhone,
  editPersonSaving,
  editPrimaryServiceTypeIds,
  editSubcontractorServiceTypeIds,
  editSuperintendentServiceTypeIds,
  editingNonUserPerson,
  editingUserId,
  error,
  estimatorGroupError,
  estimatorGroupSavingUserId,
  estimatorInboxSectionOpen,
  estimatorMemberIds,
  handleConvertMaster,
  handleRestore,
  myPeople,
  nonUserPeople,
  openArchive,
  openArchiveReassign,
  openFindDuplicatesModal,
  openInvite,
  openManualAdd,
  payApprovedError,
  payApprovedMasterIds,
  payApprovedMasters,
  payApprovedMastersSectionOpen,
  payApprovedSaving,
  restoreError,
  restoreSubmitting,
  restoringUserId,
  roleVisibilityExpanded,
  saveNonUserPersonEdit,
  saveUserEdits,
  sendSignInEmail,
  sendingSignInEmailId,
  serviceTypes,
  setActiveAccountsSectionOpen,
  setAdditionalPeopleSectionOpen,
  setArchivedSectionOpen,
  setConvertAutoAdopt,
  setConvertError,
  setConvertMasterId,
  setConvertMasterSectionOpen,
  setConvertNewMasterId,
  setConvertNewRole,
  setConvertSummary,
  setEditEmail,
  setEditEstimatorProspectsAccess,
  setEditEstimatorServiceTypeIds,
  setEditName,
  setEditPersonEmail,
  setEditPersonError,
  setEditPersonName,
  setEditPersonNotes,
  setEditPersonPhone,
  setEditPrimaryServiceTypeIds,
  setEditSubcontractorServiceTypeIds,
  setEditSuperintendentServiceTypeIds,
  setEditingNonUserPerson,
  setEstimatorInboxSectionOpen,
  setPasswordSubmitting,
  setPayApprovedMastersSectionOpen,
  setRoleVisibilityExpanded,
  setSetPasswordConfirm,
  setSetPasswordError,
  setSetPasswordUser,
  setSetPasswordValue,
  setTaskDispatchSectionOpen,
  startEditUser,
  taskDispatchSectionOpen,
  toggleDispatchGroupMember,
  toggleEstimatorGroupMember,
  togglePayApproved,
  updateRole,
  updatingId,
  users,
}: SettingsPeopleTabProps) {
  const { showToast } = useToastContext()

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
          <div className="activeAccountsCard">
            <button
              type="button"
              onClick={() => setActiveAccountsSectionOpen((prev) => !prev)}
              className="activeAccountsCard__toggle"
            >
              <span className="activeAccountsCard__chevron">{activeAccountsSectionOpen ? '▼' : '▶'}</span>
              Active Accounts
            </button>
            {activeAccountsSectionOpen && (
            <div className="activeAccountsCard__body">
          <p className="activeAccountsCard__desc">
            Set user class for everyone who has signed up. Only owners can change these.
          </p>
          <div className="activeAccountsCard__actions">
            <button type="button" onClick={openInvite} className="activeAccountsCard__btnPrimary">
              Invite via email
            </button>
            <button type="button" onClick={openManualAdd} className="activeAccountsCard__btnSecondary">
              Manually add user
            </button>
            <button type="button" onClick={openArchive} className="activeAccountsCard__btnDanger">
              Archive user
            </button>
            <button type="button" onClick={openArchiveReassign} className="activeAccountsCard__btnDanger">
              Archive User & Reassign Customers
            </button>
          </div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table className="activeAccountsCard__table">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Service types / Role</th>
                  <th>Last login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <React.Fragment key={u.id}>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
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
                            <span style={{ color: '#9ca3af' }}>—</span>
                          )}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.email)}
                            title="Click to copy email"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', color: '#6b7280' }}
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
                            if (ids === null) return <span style={{ color: '#9ca3af' }}>—</span>
                            if (ids.length === 0) return <span>All</span>
                            const pills = ids
                              .map((id) => serviceTypes.find((st) => st.id === id)?.name)
                              .filter((n): n is string => Boolean(n))
                              .map((name) => buildServiceTypeTradePill(name))
                              .filter((pill): pill is NonNullable<typeof pill> => pill !== null)
                            if (pills.length === 0) return <span style={{ color: '#9ca3af' }}>—</span>
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
                              {displayLabelForUserRole(r)}
                            </option>
                          ))}
                        </select>
                      </div>
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
                          onClick={() => sendSignInEmail(u)}
                          disabled={sendingSignInEmailId === u.id}
                          className="activeAccountsCard__rowBtn"
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
                          className="activeAccountsCard__rowBtn"
                        >
                          Set password
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingUserId === u.id && u.role === 'estimator' && (
                    <tr key={`${u.id}-service-types`} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
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
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
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
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
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
                  {editingUserId === u.id && isSubcontractorLikeRole(u.role) && (
                    <tr key={`${u.id}-subcontractor-service-types`} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td colSpan={4} style={{ padding: '0.5rem 0.75rem' }}>
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
                  Page access by role. See docs/ACCESS_CONTROL.md for full feature-level permissions.
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
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Helper</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Estimator</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Primary</th>
                        <th style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', textAlign: 'center', background: '#f9fafb' }}>Supt.</th>
                        </tr>
                      </thead>
                      <tbody>
                      {PAGE_ACCESS.map((row) => (
                        <tr key={row.page}>
                          <td style={{ border: '1px solid #e5e7eb', padding: '0.5rem 0.75rem', fontWeight: 500 }}>{row.page}</td>
                          {(['dev', 'master', 'assistant', 'sub', 'helpers', 'estimator', 'primary', 'superintendent'] as const).map((role) => {
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
                  <strong>Task Dispatch</strong> (hard-hat header button): choose which <strong>assistants</strong> and <strong>estimators</strong> receive those push notifications and see the Dispatch inbox on the Dashboard.
                  This is separate from <strong>Estimator Inbox</strong> (purple pencil button). Only Assistant or Estimator accounts can be added (enforced by the database).
                </p>
                {dispatchMemberIds.size === 0 && (
                  <p style={{ marginBottom: '0.75rem', color: '#b45309', fontSize: '0.875rem' }}>
                    No Task Dispatch members yet — nobody will receive Task Dispatch pushes until you select at least one assistant or estimator.
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
              onClick={() => setEstimatorInboxSectionOpen((prev) => !prev)}
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
              <span style={{ fontSize: '0.75rem' }}>{estimatorInboxSectionOpen ? '▼' : '▶'}</span>
              Estimator Inbox group
            </button>
            {estimatorInboxSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginTop: 0, marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  <strong>Estimator Inbox</strong> (purple pencil header button): choose which <strong>assistants</strong> and <strong>estimators</strong> receive those push notifications and see the Estimator inbox on the Dashboard.
                  Independent from Task Dispatch. Only Assistant or Estimator accounts can be added.
                </p>
                {estimatorMemberIds.size === 0 && (
                  <p style={{ marginBottom: '0.75rem', color: '#b45309', fontSize: '0.875rem' }}>
                    No Estimator Inbox members yet — nobody will receive Estimator Inbox pushes until you select at least one assistant or estimator.
                  </p>
                )}
                {estimatorGroupError && (
                  <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{estimatorGroupError}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 480 }}>
                  {users
                    .filter((u) => u.role === 'assistant' || u.role === 'estimator')
                    .map((u) => {
                      const checked = estimatorMemberIds.has(u.id)
                      return (
                        <label
                          key={u.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: estimatorGroupSavingUserId ? 'not-allowed' : 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!!estimatorGroupSavingUserId}
                            onChange={() => toggleEstimatorGroupMember(u.id, checked)}
                          />
                          <span>
                            {u.name || u.email}
                            {u.email && u.name ? (
                              <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.35rem' }}>({u.email})</span>
                            ) : null}
                          </span>
                          {estimatorGroupSavingUserId === u.id && (
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
  )
}
