/** Settings → People & accounts tab (dev content): active accounts (via
 * ActiveAccountsPanel — shared with the app-level Active Accounts modal),
 * group memberships, non-user people, and the page-access reference table.
 * Presentational; remaining state/handlers live in the parent (Settings.tsx). */
import { type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { PersonRow, UserRow } from '../../types/settingsRows'
import TeamFeedbackDevSettingsBlock from '../team-feedback/TeamFeedbackDevSettingsBlock'
import ActiveAccountsPanel from './ActiveAccountsPanel'

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

type SettingsPeopleTabProps = {
  additionalPeopleSectionOpen: boolean
  allPeopleCount: number
  deleteNonUserPerson: (p: PersonRow) => void
  deletingPersonId: string | null
  dispatchGroupError: string | null
  dispatchGroupSavingUserId: string | null
  dispatchMemberIds: Set<string>
  editPersonEmail: string
  editPersonError: string | null
  editPersonName: string
  editPersonNotes: string
  editPersonPhone: string
  editPersonSaving: boolean
  editingNonUserPerson: PersonRow | null
  error: string | null
  estimatorGroupError: string | null
  estimatorGroupSavingUserId: string | null
  estimatorInboxSectionOpen: boolean
  estimatorMemberIds: Set<string>
  myPeople: PersonRow[]
  nonUserPeople: PersonRow[]
  openFindDuplicatesModal: () => void
  onActiveAccountsDataChanged: () => void
  payApprovedError: string | null
  payApprovedMasterIds: Set<string>
  payApprovedMasters: UserRow[]
  payApprovedMastersSectionOpen: boolean
  payApprovedSaving: boolean
  roleVisibilityExpanded: boolean
  saveNonUserPersonEdit: (e: FormEvent) => void
  setAdditionalPeopleSectionOpen: Dispatch<SetStateAction<boolean>>
  setEditPersonEmail: Dispatch<SetStateAction<string>>
  setEditPersonError: Dispatch<SetStateAction<string | null>>
  setEditPersonName: Dispatch<SetStateAction<string>>
  setEditPersonNotes: Dispatch<SetStateAction<string>>
  setEditPersonPhone: Dispatch<SetStateAction<string>>
  setEditingNonUserPerson: Dispatch<SetStateAction<PersonRow | null>>
  setEstimatorInboxSectionOpen: Dispatch<SetStateAction<boolean>>
  setPayApprovedMastersSectionOpen: Dispatch<SetStateAction<boolean>>
  setRoleVisibilityExpanded: Dispatch<SetStateAction<boolean>>
  setTaskDispatchSectionOpen: Dispatch<SetStateAction<boolean>>
  taskDispatchSectionOpen: boolean
  toggleDispatchGroupMember: (userId: string, currentlyMember: boolean) => void
  toggleEstimatorGroupMember: (userId: string, currentlyMember: boolean) => void
  togglePayApproved: (masterId: string, isApproved: boolean) => void
  users: UserRow[]
}

export default function SettingsPeopleTab({
  additionalPeopleSectionOpen,
  allPeopleCount,
  deleteNonUserPerson,
  deletingPersonId,
  dispatchGroupError,
  dispatchGroupSavingUserId,
  dispatchMemberIds,
  editPersonEmail,
  editPersonError,
  editPersonName,
  editPersonNotes,
  editPersonPhone,
  editPersonSaving,
  editingNonUserPerson,
  error,
  estimatorGroupError,
  estimatorGroupSavingUserId,
  estimatorInboxSectionOpen,
  estimatorMemberIds,
  myPeople,
  nonUserPeople,
  openFindDuplicatesModal,
  onActiveAccountsDataChanged,
  payApprovedError,
  payApprovedMasterIds,
  payApprovedMasters,
  payApprovedMastersSectionOpen,
  payApprovedSaving,
  roleVisibilityExpanded,
  saveNonUserPersonEdit,
  setAdditionalPeopleSectionOpen,
  setEditPersonEmail,
  setEditPersonError,
  setEditPersonName,
  setEditPersonNotes,
  setEditPersonPhone,
  setEditingNonUserPerson,
  setEstimatorInboxSectionOpen,
  setPayApprovedMastersSectionOpen,
  setRoleVisibilityExpanded,
  setTaskDispatchSectionOpen,
  taskDispatchSectionOpen,
  toggleDispatchGroupMember,
  toggleEstimatorGroupMember,
  togglePayApproved,
  users,
}: SettingsPeopleTabProps) {

  return (
    <>
          <ActiveAccountsPanel
            variant="card"
            onDataChanged={onActiveAccountsDataChanged}
            onOpenFindDuplicates={openFindDuplicatesModal}
          />

          <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
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
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Page access by role. See docs/ACCESS_CONTROL.md for full feature-level permissions.
                </p>
                <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 520 }}>
                      <thead>
                      <tr>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'var(--bg-subtle)' }}>Page</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Dev</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Master</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Assistant</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Sub</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Helper</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Estimator</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Primary</th>
                        <th style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--bg-subtle)' }}>Supt.</th>
                        </tr>
                      </thead>
                      <tbody>
                      {PAGE_ACCESS.map((row) => (
                        <tr key={row.page}>
                          <td style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', fontWeight: 500 }}>{row.page}</td>
                          {(['dev', 'master', 'assistant', 'sub', 'helpers', 'estimator', 'primary', 'superintendent'] as const).map((role) => {
                            const val = row[role]
                            return (
                              <td key={role} style={{ border: '1px solid var(--border)', padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                {val === 'yes' ? '✓' : val === 'no' ? '✗' : val}
                              </td>
                            )
                          })}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  Redirection: Subcontractors → /dashboard; Estimators → /bids; Primary → /dashboard (Jobs: Reports tab only; Bids: Bid Board, RFI, Change Order, Lien Release; Projects hidden).
                </p>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
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
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <strong>Task Dispatch</strong> (hard-hat header button): choose which <strong>assistants</strong> and <strong>estimators</strong> receive those push notifications and see the Dispatch inbox on the Dashboard.
                  This is separate from <strong>Estimator Inbox</strong> (purple pencil button). Only Assistant or Estimator accounts can be added (enforced by the database).
                </p>
                {dispatchMemberIds.size === 0 && (
                  <p style={{ marginBottom: '0.75rem', color: 'var(--text-amber-700)', fontSize: '0.875rem' }}>
                    No Task Dispatch members yet — nobody will receive Task Dispatch pushes until you select at least one assistant or estimator.
                  </p>
                )}
                {dispatchGroupError && (
                  <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem' }}>{dispatchGroupError}</p>
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
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.35rem' }}>({u.email})</span>
                            ) : null}
                          </span>
                          {dispatchGroupSavingUserId === u.id && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving…</span>
                          )}
                        </label>
                      )
                    })}
                  {users.filter((u) => u.role === 'assistant' || u.role === 'estimator').length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No assistant or estimator accounts in the system.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
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
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <strong>Estimator Inbox</strong> (purple pencil header button): choose which <strong>assistants</strong> and <strong>estimators</strong> receive those push notifications and see the Estimator inbox on the Dashboard.
                  Independent from Task Dispatch. Only Assistant or Estimator accounts can be added.
                </p>
                {estimatorMemberIds.size === 0 && (
                  <p style={{ marginBottom: '0.75rem', color: 'var(--text-amber-700)', fontSize: '0.875rem' }}>
                    No Estimator Inbox members yet — nobody will receive Estimator Inbox pushes until you select at least one assistant or estimator.
                  </p>
                )}
                {estimatorGroupError && (
                  <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem' }}>{estimatorGroupError}</p>
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
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.35rem' }}>({u.email})</span>
                            ) : null}
                          </span>
                          {estimatorGroupSavingUserId === u.id && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving…</span>
                          )}
                        </label>
                      )
                    })}
                  {users.filter((u) => u.role === 'assistant' || u.role === 'estimator').length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No assistant or estimator accounts in the system.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
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
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                  Masters selected here can access the Pay and Hours tabs on the People page. Their assistants can enter hours in the Hours tab.
                </p>
                {payApprovedError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{payApprovedError}</p>}
                {payApprovedMasters.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No masters or devs found.</p>
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
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            cursor: payApprovedSaving ? 'not-allowed' : 'pointer',
                            background: isApproved ? 'var(--bg-green-tint)' : 'var(--surface)',
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
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                ({m.email})
                              </span>
                            )}
                            {m.role === 'dev' && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>dev</span>
                            )}
                          </span>
                          {isApproved && (
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
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

          <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
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
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>People Created by Me</h2>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              People entries in your roster.
            </p>
            {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Phone</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Kind</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myPeople.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.email ? (
                          <a href={`mailto:${p.email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                            {p.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.phone ? (
                          <a href={`tel:${p.phone}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
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
                          <span style={{ color: 'var(--text-green-600)', fontWeight: 500 }}>Has account</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>No account</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
            {myPeople.length === 0 && <p style={{ marginTop: '1rem' }}>No people entries created by you.</p>}

            <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>People Created by Other Users</h2>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              People entries in rosters created by other users, and who created them.
            </p>
            {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
            {nonUserPeople.length === 0 && allPeopleCount > 0 && (
              <p style={{ color: '#f59e0b', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Note: All {allPeopleCount} visible people entry{allPeopleCount !== 1 ? 'ies' : ''} belong to you. The RLS policy for the &apos;people&apos; table may be restricting access to other users&apos; entries. To see people created by other users, the RLS policy needs to allow owners to read all entries.
              </p>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
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
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.email ? (
                          <a href={`mailto:${p.email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                            {p.email}
                          </a>
                        ) : (
                          '—'
                        )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.phone ? (
                          <a href={`tel:${p.phone}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
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
                          <span style={{ color: 'var(--text-green-600)', fontWeight: 500 }}>Has account</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>No account</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {p.creator_name || p.creator_email ? (
                          <span>
                            {p.creator_name || 'Unknown'}
                            {p.creator_email && (
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
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
                            style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
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
                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
                  <h2 style={{ marginTop: 0 }}>Edit person: {editingNonUserPerson.name}</h2>
                  {editPersonError && <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem' }}>{editPersonError}</p>}
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
