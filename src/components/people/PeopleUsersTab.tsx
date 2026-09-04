import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import type { Person, PersonKind, UserRow } from '../../hooks/usePeopleRoster'
import type { UsersTabTagAnchor, UsersTabTagsApi } from '../../hooks/useUsersTabTags'
import type { ContractSigningTrafficLight } from '../../lib/contractSigningRollup'
import { useOptionalPersonDesk } from '../../contexts/PersonDeskContext'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { useUsersTabSignals } from '../../hooks/useUsersTabSignals'
import { buildRailRow, normaliseKind, type RailRow } from '../../lib/people/deskRailAttention'
import { USERS_TAB_FILTERS, describeGroupCount, foldNoLoginRows, orderUsersTabRows, rowMatchesFilter, type UsersTabFilter } from '../../lib/people/usersTabRows'
import { UsersTabRow, type UsersTabRowMenuAction } from './UsersTabRow'
import { PeopleUserTagsPanel } from './PeopleUserTagsPanel'
import {
  buildUsersTabKindRoster,
  KIND_LABELS,
  KIND_TO_USER_ROLE,
  USERS_TAB_SECTIONS,
  usersTabRowMatchesSearch,
  type UsersTabRosterListRow,
  type UsersTabSection,
} from './peopleUsersTabShared'
import CombinePeopleModal from './CombinePeopleModal'
import TeamLeadsModal from './TeamLeadsModal'

type PersonActiveProject = { id: string; name: string }

type EditingUserNote = { id: string; name: string; notes: string; phone: string }

interface PeopleUsersTabProps {
  isDev: boolean
  /** Dev-only: opens the app-level Active Accounts management modal (button right of the search bar). */
  onOpenActiveAccounts?: () => void
  narrowViewport: boolean
  users: UserRow[]
  people: Person[]
  error: string | null
  setError: (value: string | null) => void
  contractSigningStatusByPersonName: Record<string, ContractSigningTrafficLight>
  canAccessContracts: boolean
  canSeePushStatus: boolean
  pushEnabledUserIds: Set<string>
  locationEnabledUserIds: Set<string>
  canEditUserNotes: boolean
  canCreatePeopleInRoster: boolean
  authUserId: string | undefined
  creatorNames: Record<string, string>
  personProjects: Record<string, PersonActiveProject[]>
  archivedPeople: Array<Person & { archived_at: string }>
  usersTabTags: UsersTabTagsApi
  showToast: (message: string, type: 'success' | 'error') => void
  setEditingUserNote: (value: EditingUserNote | null) => void
  openAdd: (kind: PersonKind) => void
  openEdit: (item: Person) => void
  /** Sets people.account_user_id so the external row folds into the account row. */
  linkPersonToAccount: (personId: string, userId: string | null) => Promise<boolean>
  archivePerson: (id: string) => void
  archivingId: string | null
  restorePerson: (id: string) => void
  restoringId: string | null
  isAlreadyUser: (email: string | null) => boolean
  invitingId: string | null
  setInviteConfirm: (person: Person | null) => void
  loggingInAsId: string | null
  setLoggingInAsId: (id: string | null) => void
  externalSubProjectsExpanded: Set<string>
  setExternalSubProjectsExpanded: Dispatch<SetStateAction<Set<string>>>
  archivedSectionOpen: boolean
  setArchivedSectionOpen: Dispatch<SetStateAction<boolean>>
}

export function PeopleUsersTab({
  isDev,
  onOpenActiveAccounts,
  narrowViewport,
  users,
  people,
  error,
  setError,
  contractSigningStatusByPersonName,
  canAccessContracts,
  canSeePushStatus,
  pushEnabledUserIds,
  canEditUserNotes,
  canCreatePeopleInRoster,
  authUserId,
  creatorNames,
  personProjects,
  archivedPeople,
  usersTabTags,
  showToast,
  setEditingUserNote,
  openAdd,
  openEdit,
  linkPersonToAccount,
  archivePerson,
  archivingId,
  restorePerson,
  restoringId,
  isAlreadyUser,
  invitingId,
  setInviteConfirm,
  loggingInAsId,
  setLoggingInAsId,
  archivedSectionOpen,
  setArchivedSectionOpen,
}: PeopleUsersTabProps) {
  const [usersTabSearch, setUsersTabSearch] = useState('')
  const usersTabSearchQ = useMemo(() => usersTabSearch.trim().toLowerCase(), [usersTabSearch])
  /** v2.2762: roster-only rows fold behind "+ N more without a login" per kind; searching or the No-login filter opens every fold. */
  const [noLoginOpenKinds, setNoLoginOpenKinds] = useState<Set<PersonKind>>(() => new Set())
  const [filter, setFilter] = useState<UsersTabFilter>('all')
  // Link-to-account modal (external roster rows → app account).
  const [linkTarget, setLinkTarget] = useState<Person | null>(null)
  const [linkUserId, setLinkUserId] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)
  // Combine-people modal (fold a duplicate roster identity into the keeper, v2.982).
  const [combineSource, setCombineSource] = useState<Person | null>(null)
  // Team leads manager modal (moved here from Settings → Dashboard & alerts).
  // Same gate the Settings manager had (dev|master|assistant-like), which also
  // matches the People Teams tab gate (dev/master_technician/assistant/controller).
  const { role: authRole } = useAuth()
  // Person Desk door (v2.2701): the name opens the per-person drawer for office roles.
  const personDesk = useOptionalPersonDesk()
  const access = usePeopleAccess(authUserId)
  const { facts: railFacts } = useUsersTabSignals(
    { canAccessHours: access.canAccessHours, canAccessPay: access.canAccessPay, canAccessContracts: access.canAccessContracts, canAccessLicenses: access.canAccessLicenses },
    true,
  )
  const canManageTeamLeads = authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const [teamLeadsModalOpen, setTeamLeadsModalOpen] = useState(false)

  const byKind = useCallback(
    (k: PersonKind) => buildUsersTabKindRoster(k, users, people),
    [users, people],
  )

  const usersTabSectionHasVisibleRows = useCallback(
    (sec: UsersTabSection): boolean => {
      if (sec.type === 'dev') {
        if (!isDev) return false
        if (!usersTabSearchQ) return true
        const devUsersAll = users.filter((u) => u.role === 'dev')
        return devUsersAll.some((u) => usersTabRowMatchesSearch(u, usersTabSearchQ))
      }
      const k = sec.kind
      if (!usersTabSearchQ) return true
      if (k === 'sub' || k === 'helper') {
        const items = byKind(k)
        if (items.length === 0) return false
        const withAccount = items.filter((i) => i.source === 'user')
        const external = items.filter((i) => i.source === 'people')
        const q = usersTabSearchQ
        const withAccountF = withAccount.filter((i) => usersTabRowMatchesSearch(i, q))
        const externalF = external.filter((i) => usersTabRowMatchesSearch(i, q))
        return withAccountF.length > 0 || externalF.length > 0
      }
      const kindItems = byKind(k)
      if (kindItems.length === 0) return false
      return kindItems.some((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
    },
    [usersTabSearchQ, isDev, users, byKind],
  )

  const usersTabSearchShowsNoSections = useMemo(() => {
    if (!usersTabSearchQ) return false
    return USERS_TAB_SECTIONS.every((sec) => !usersTabSectionHasVisibleRows(sec))
  }, [usersTabSearchQ, usersTabSectionHasVisibleRows])

  const resolvePersonIdForUsersRow = useCallback(
    (
      item: { source: 'people' | 'user'; id: string; email: string | null },
      sectionKind: PersonKind | null,
    ): string | null => {
      if (item.source === 'people') return item.id
      const e = item.email?.trim().toLowerCase()
      if (!e) return null
      if (sectionKind) {
        const p = people.find((x) => x.kind === sectionKind && x.email?.toLowerCase() === e)
        return p?.id ?? null
      }
      const p = people.find((x) => x.email?.toLowerCase() === e)
      return p?.id ?? null
    },
    [people],
  )

  function resolveUsersTabTagAnchor(
    item: { source: 'user' | 'people'; id: string; email: string | null },
    sectionKind: PersonKind | null,
  ): UsersTabTagAnchor {
    const personId = resolvePersonIdForUsersRow(item, sectionKind)
    if (personId) return { kind: 'person', personId }
    return { kind: 'user', userId: item.id }
  }

  /** Attention + signal chips for one row, from the same facts the Person tab rail uses. */
  function railFor(sectionKind: PersonKind | 'dev', item: UsersTabRosterListRow): RailRow {
    const personId = item.source === 'people' ? item.id : (people.find((p) => p.account_user_id === item.id)?.id ?? resolvePersonIdForUsersRow(item, sectionKind === 'dev' ? null : sectionKind))
    return buildRailRow(
      { userId: item.source === 'user' ? item.id : null, personId, name: item.name, kind: sectionKind === 'dev' ? 'dev' : normaliseKind(sectionKind), archived: false },
      railFacts,
    )
  }

  function menuFor(sectionKind: PersonKind | 'dev', item: UsersTabRosterListRow): UsersTabRowMenuAction[] {
    const out: UsersTabRowMenuAction[] = []
    if (personDesk?.canOpen) {
      out.push({ key: 'desk', label: 'Open desk', onClick: () => personDesk.open(item.source === 'user' ? { userId: item.id, displayName: item.name } : { personId: item.id, displayName: item.name }) })
    }
    if (item.source === 'user') {
      if (canEditUserNotes) {
        out.push({
          key: 'note',
          label: 'Edit name, title & phone',
          onClick: () => setEditingUserNote({ id: item.id, name: item.name, notes: ('notes' in item ? item.notes : null) ?? '', phone: ('phone' in item ? item.phone : null) ?? '' }),
        })
      }
      return out
    }
    const person = item as Person
    const owner = person.master_user_id === authUserId || isDev
    if (!isAlreadyUser(person.email)) {
      out.push({
        key: 'invite',
        label: invitingId === person.id ? 'Sending…' : 'Invite as user',
        disabled: !person.email?.trim() || invitingId === person.id,
        title: !person.email?.trim() ? 'Add an email first' : 'Give them a login by email',
        onClick: () => setInviteConfirm(person),
      })
    }
    out.push({ key: 'edit', label: 'Edit', onClick: () => openEdit(person) })
    if (owner) {
      out.push({ key: 'link', label: 'Link account', title: 'Attach this roster row to an app account so only one row shows', onClick: () => { setLinkTarget(person); setLinkUserId('') } })
      out.push({ key: 'combine', label: 'Combine…', title: 'Fold this duplicate identity into another person', onClick: () => setCombineSource(person) })
      out.push({ key: 'archive', label: archivingId === person.id ? '…' : 'Archive', danger: true, disabled: archivingId === person.id, onClick: () => archivePerson(person.id) })
    }
    void sectionKind
    return out
  }

  function renderUsersTabRosterListItem(sectionKind: PersonKind | 'dev', item: UsersTabRosterListRow, rail: RailRow) {
    const activeProjectRows = personProjects[item.name.trim()] ?? []
    const person = item.source === 'people' ? (item as Person) : null
    return (
      <UsersTabRow
        key={item.source === 'user' ? `user-${item.id}` : `people-${item.id}`}
        item={{ source: item.source, id: item.id, name: item.name, email: item.email, phone: ('phone' in item ? item.phone : null) ?? null, notes: ('notes' in item ? item.notes : null) ?? null, master_user_id: person?.master_user_id }}
        rail={rail}
        narrowViewport={narrowViewport}
        isDev={isDev}
        pushOn={item.source === 'user' && pushEnabledUserIds.has(item.id)}
        showPush={canSeePushStatus}
        signingLight={canAccessContracts ? contractSigningStatusByPersonName[item.name] : undefined}
        activeProjects={activeProjectRows}
        loggingInAsId={loggingInAsId}
        setLoggingInAsId={setLoggingInAsId}
        setError={setError}
        menu={menuFor(sectionKind, item)}
        createdBy={person && person.master_user_id !== authUserId ? (creatorNames[person.master_user_id] ?? 'Unknown') : null}
        below={
          isDev && usersTabTags.showUsersTabTags ? (
            <PeopleUserTagsPanel anchor={resolveUsersTabTagAnchor({ source: item.source, id: item.id, email: item.email }, sectionKind === 'dev' ? null : sectionKind)} people={people} tags={usersTabTags} showToast={showToast} />
          ) : null
        }
      />
    )
  }

  /** One group (a kind, or the devs): filtered, ordered, folded. Returns null when nothing in it shows. */
  function renderGroup(sectionKind: PersonKind | 'dev') {
    const items: UsersTabRosterListRow[] =
      sectionKind === 'dev'
        ? users.filter((u) => u.role === 'dev').map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email, phone: u.phone ?? null, notes: u.notes }))
        : byKind(sectionKind)
    const label = sectionKind === 'dev' ? 'Devs' : KIND_LABELS[sectionKind]
    const rails = items.map((item) => ({ item, rail: railFor(sectionKind, item) }))
    const visible = rails.filter(({ item, rail }) => (usersTabSearchQ ? usersTabRowMatchesSearch(item, usersTabSearchQ) : true) && rowMatchesFilter(rail, filter))
    const hasAnyRows = items.length > 0
    if ((usersTabSearchQ || filter !== 'all') && visible.length === 0) return null
    const orderedRails = orderUsersTabRows(visible.map((v) => v.rail))
    const byKey = new Map(rails.map((v) => [v.rail.userId ?? v.rail.personId ?? v.item.id, v]))
    const forceOpen = Boolean(usersTabSearchQ) || filter === 'nologin' || (sectionKind !== 'dev' && noLoginOpenKinds.has(sectionKind))
    const { shown, folded } = foldNoLoginRows(orderedRails, { forceOpen })
    const rowOf = (r: RailRow) => byKey.get(r.userId ?? r.personId ?? r.name)
    return (
      <section key={`users-tab-${sectionKind}`} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>
            {label} <span style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{describeGroupCount(rails.map((v) => v.rail))}</span>
          </h2>
          {sectionKind !== 'dev' && canCreatePeopleInRoster ? (
            <button type="button" onClick={() => openAdd(sectionKind)} style={{ padding: '0.25rem 0.65rem', fontSize: '0.8125rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
              Add
            </button>
          ) : null}
        </div>
        {!hasAnyRows ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {shown.map((r) => {
              const v = rowOf(r)
              return v ? renderUsersTabRosterListItem(sectionKind, v.item, v.rail) : null
            })}
            {folded.length > 0 && sectionKind !== 'dev' ? (
              <li style={{ padding: '0.45rem 0' }}>
                <button
                  type="button"
                  onClick={() => setNoLoginOpenKinds((prev) => new Set(prev).add(sectionKind))}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline' }}
                >
                  + {folded.length} more without a login
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </section>
    )
  }

  return (
    <>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      {/* Wraps on phones: the search box plus both nowrap buttons need ~440px of
          min-content, which floored the whole page at 375px (E2E phone-overflow
          smoke). Wrapping keeps the one-row desktop layout untouched. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg-page)', padding: '0.25rem 0 0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="search"
            value={usersTabSearch}
            onChange={(e) => setUsersTabSearch(e.target.value)}
            placeholder="Search by name, email, phone…"
            aria-label="Search people on Users tab"
            style={{ flex: '1 1 12rem', minWidth: 0, padding: '0.3rem 0.65rem', fontSize: '0.875rem', lineHeight: 1.35, border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box' }}
          />
          {canManageTeamLeads && (
            <button type="button" onClick={() => setTeamLeadsModalOpen(true)} className="activeAccountsCard__btnSecondary" style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem' }} title="Who approves whose hours">
              Team leads
            </button>
          )}
          {onOpenActiveAccounts && (
            <button type="button" onClick={onOpenActiveAccounts} className="activeAccountsCard__btnSecondary" style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem' }} title="Roles, passwords, sign-in emails, archive (dev)">
              Accounts · dev
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setArchivedSectionOpen((prev) => !prev)
              setTimeout(() => document.getElementById('users-tab-archived')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="activeAccountsCard__btnSecondary"
            style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem' }}
            aria-expanded={archivedSectionOpen}
          >
            Archived ({archivedPeople.length})
          </button>
          {canCreatePeopleInRoster ? (
            <button type="button" onClick={() => openAdd('helper')} style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }} title="A roster row — no login needed">
              + Add to roster
            </button>
          ) : null}
        </div>
        <div role="group" aria-label="Filter people" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
          {USERS_TAB_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 999,
                padding: '0.1rem 0.6rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: filter === f.key ? '1px solid #2563eb' : '1px solid var(--border)',
                background: filter === f.key ? '#2563eb' : 'var(--surface)',
                color: filter === f.key ? '#fff' : 'var(--text-700)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {usersTabSearchShowsNoSections ? (
        <p role="status" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
          No matches.
        </p>
      ) : null}
      {USERS_TAB_SECTIONS.map((sec) => (sec.type === 'dev' ? (isDev ? renderGroup('dev') : null) : renderGroup(sec.kind)))}
      {!usersTabSearchQ && filter !== 'all' && USERS_TAB_SECTIONS.every((sec) => (sec.type === 'dev' ? !isDev || renderGroup('dev') == null : renderGroup(sec.kind) == null)) ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nobody matches that filter.</p>
      ) : null}

      {/* Archived people */}
      <div id="users-tab-archived" style={{ marginTop: '2rem', maxWidth: 640 }}>
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
          Archived people ({archivedPeople.length})
        </button>
        {archivedSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem' }}>
            {archivedPeople.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No archived people.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Archived</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedPeople.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.email ?? '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                          {p.archived_at ? new Date(p.archived_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => restorePerson(p.id)}
                            disabled={restoringId === p.id}
                            style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                          >
                            {restoringId === p.id ? 'Restoring…' : 'Restore'}
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
      {isDev && (
        <>
          <div
            style={{
              marginTop: '1.5rem',
              width: '100%',
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '0.75rem 1rem',
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.875rem',
                color: 'var(--text-700)',
                fontWeight: 500,
              }}
            >
              <span>Tags</span>
              <input
                type="checkbox"
                checked={usersTabTags.showUsersTabTags}
                onChange={(e) => usersTabTags.setShowUsersTabTags(e.target.checked)}
              />
            </label>
            {usersTabTags.showUsersTabTags && (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-700)',
                  fontWeight: 500,
                }}
              >
                <span>{'·'}</span>
                <span>{'Tag org, signals & new tag'}</span>
                <input
                  type="checkbox"
                  checked={usersTabTags.showUsersTabTagOrgSignals}
                  onChange={(e) => usersTabTags.setShowUsersTabTagOrgSignals(e.target.checked)}
                />
              </label>
            )}
          </div>
          {usersTabTags.showUsersTabTags && usersTabTags.showUsersTabTagOrgSignals && (
            <div
              style={{
                marginTop: '1.25rem',
                width: '100%',
                maxWidth: '56rem',
              }}
            >
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: '0.5rem' }}>
                Label catalog
              </h3>
              {usersTabTags.usersTabLabelUsageLoading ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading label usage…</p>
              ) : usersTabTags.usersTabLabels.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No labels loaded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Tag</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Master</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>People</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Users</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Total</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...usersTabTags.usersTabLabels]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((row) => {
                          const usage = usersTabTags.usersTabLabelUsageById[row.id] ?? { people: 0, users: 0 }
                          const total = usage.people + usage.users
                          const masterDisp = usersTabTags.tagOrgMasterLabel(row.master_user_id)
                          return (
                            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.45rem 0.75rem' }}>{row.name}</td>
                              <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-600)' }}>{masterDisp}</td>
                              <td style={{ padding: '0.45rem 0.75rem' }}>{usage.people}</td>
                              <td style={{ padding: '0.45rem 0.75rem' }}>{usage.users}</td>
                              <td style={{ padding: '0.45rem 0.75rem' }}>{total}</td>
                              <td style={{ padding: '0.45rem 0.75rem' }}>
                                <button
                                  type="button"
                                  disabled={total !== 0 || usersTabTags.usersTabLabelCatalogDeletingId === row.id}
                                  title={
                                    total !== 0
                                      ? 'Remove all assignments before deleting this tag'
                                      : 'Delete unused tag from catalog'
                                  }
                                  onClick={() => {
                                    if (total !== 0) return
                                    void usersTabTags.deleteLabelFromCatalog(row.id)
                                  }}
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    fontSize: '0.75rem',
                                    opacity: total !== 0 ? 0.45 : 1,
                                  }}
                                >
                                  {usersTabTags.usersTabLabelCatalogDeletingId === row.id ? 'Deleting…' : 'Delete'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {linkTarget && (() => {
        const wantedRole = KIND_TO_USER_ROLE[linkTarget.kind as PersonKind] ?? null
        const alreadyLinkedUserIds = new Set(
          people.filter((p) => p.id !== linkTarget.id && p.account_user_id).map((p) => p.account_user_id as string),
        )
        const candidates = users
          .filter((u) => (wantedRole ? u.role === wantedRole : true) && !alreadyLinkedUserIds.has(u.id))
          .sort((a, b) => a.name.localeCompare(b.name))
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Link ${linkTarget.name} to an app account`}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
          >
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 440 }}>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>Link {linkTarget.name} to an account</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Their pay history, crew records, and payments stay on this person and follow the account —
                afterwards only the account row shows in the roster.
              </p>
              {candidates.length === 0 ? (
                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
                  No unlinked {wantedRole ?? ''} accounts to link. Create the account first (Manage accounts).
                </p>
              ) : (
                <select
                  value={linkUserId}
                  onChange={(e) => setLinkUserId(e.target.value)}
                  aria-label="Account to link"
                  style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: '1rem', boxSizing: 'border-box' }}
                >
                  <option value="">Choose an account…</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.email ? ` — ${u.email}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setLinkTarget(null)}
                  disabled={linkSaving}
                  style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!linkUserId || linkSaving}
                  onClick={async () => {
                    if (!linkUserId) return
                    setLinkSaving(true)
                    const ok = await linkPersonToAccount(linkTarget.id, linkUserId)
                    setLinkSaving(false)
                    if (ok) {
                      showToast(`${linkTarget.name} linked — one row now shows in the roster`, 'success')
                      setLinkTarget(null)
                    }
                  }}
                  style={{ padding: '0.45rem 0.9rem', background: !linkUserId || linkSaving ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: !linkUserId || linkSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                >
                  {linkSaving ? 'Linking…' : 'Link'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      <TeamLeadsModal open={teamLeadsModalOpen} onClose={() => setTeamLeadsModalOpen(false)} />
      {combineSource && (
        <CombinePeopleModal
          source={{ id: combineSource.id, name: combineSource.name, account_user_id: combineSource.account_user_id ?? null }}
          candidates={people
            .filter((p) => p.id !== combineSource.id)
            .map((p) => ({ id: p.id, name: p.name, account_user_id: p.account_user_id ?? null }))}
          onClose={() => setCombineSource(null)}
          onCombined={() => archivePerson(combineSource.id)}
        />
      )}
    </>
  )
}
