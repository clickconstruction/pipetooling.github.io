import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import type { Person, PersonKind, UserRow } from '../../hooks/usePeopleRoster'
import type { UsersTabTagAnchor, UsersTabTagsApi } from '../../hooks/useUsersTabTags'
import { contractSigningIconTitle, type ContractSigningTrafficLight } from '../../lib/contractSigningRollup'
import { loginAsUser } from '../../lib/loginAsUser'
import { PeopleUserTagsPanel } from './PeopleUserTagsPanel'
import {
  buildUsersTabKindRoster,
  KIND_LABELS,
  KIND_TO_USER_ROLE,
  USERS_TAB_SECTIONS,
  usersTabContactRowStyle,
  usersTabRowMatchesSearch,
  type UsersTabRosterListRow,
  type UsersTabSection,
} from './peopleUsersTabShared'
import CombinePeopleModal from './CombinePeopleModal'

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
  locationEnabledUserIds,
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
  externalSubProjectsExpanded,
  setExternalSubProjectsExpanded,
  archivedSectionOpen,
  setArchivedSectionOpen,
}: PeopleUsersTabProps) {
  const [usersTabSearch, setUsersTabSearch] = useState('')
  const usersTabSearchQ = useMemo(() => usersTabSearch.trim().toLowerCase(), [usersTabSearch])
  const [externalSubsExpanded, setExternalSubsExpanded] = useState(false)
  // Link-to-account modal (external roster rows → app account).
  const [linkTarget, setLinkTarget] = useState<Person | null>(null)
  const [linkUserId, setLinkUserId] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)
  // Combine-people modal (fold a duplicate roster identity into the keeper, v2.982).
  const [combineSource, setCombineSource] = useState<Person | null>(null)

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

  function renderUsersTabRosterListItem(sectionKind: PersonKind, item: UsersTabRosterListRow) {
    const activeProjectRows = personProjects[item.name.trim()]
    const activeProjectCount = activeProjectRows?.length ?? 0
    const isExternalSubRoster =
      (sectionKind === 'sub' || sectionKind === 'helper') && item.source === 'people'

    const contractsSigningLight = contractSigningStatusByPersonName[item.name]

    return (
      <li
        key={item.source === 'user' ? `user-${item.id}` : `people-${item.id}`}
        style={{
          padding: '0.5rem 0',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: narrowViewport ? 'flex-start' : 'center',
          gap: '0.5rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <div>
            {item.source === 'user' && canSeePushStatus && pushEnabledUserIds.has(item.id) && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 640 640"
                width={14}
                height={14}
                fill="#22c55e"
                role="img"
                aria-hidden
                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
              >
                <title>Push notifications enabled</title>
                <path d="M320 64C302.3 64 288 78.3 288 96L288 99.2C215 114 160 178.6 160 256L160 277.7C160 325.8 143.6 372.5 113.6 410.1L103.8 422.3C98.7 428.6 96 436.4 96 444.5C96 464.1 111.9 480 131.5 480L508.4 480C528 480 543.9 464.1 543.9 444.5C543.9 436.4 541.2 428.6 536.1 422.3L526.3 410.1C496.4 372.5 480 325.8 480 277.7L480 256C480 178.6 425 114 352 99.2L352 96C352 78.3 337.7 64 320 64zM258 528C265.1 555.6 290.2 576 320 576C349.8 576 374.9 555.6 382 528L258 528z" />
              </svg>
            )}
            {item.source === 'user' && isDev && locationEnabledUserIds.has(item.id) && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 640 640"
                width={14}
                height={14}
                fill="#22c55e"
                role="img"
                aria-hidden
                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
              >
                <title>Location service enabled</title>
                <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
              </svg>
            )}
            {canAccessContracts && contractsSigningLight && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 640 640"
                width={14}
                height={14}
                fill={
                  contractsSigningLight === 'green'
                    ? '#22c55e'
                    : contractsSigningLight === 'yellow'
                      ? '#eab308'
                      : '#ef4444'
                }
                role="img"
                aria-hidden
                style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
              >
                <title>{contractSigningIconTitle(contractsSigningLight)}</title>
                <path d="M64.1 128C64.1 92.7 92.8 64 128.1 64L277.6 64C294.6 64 310.9 70.7 322.9 82.7L429.3 189.3C441.3 201.3 448 217.6 448 234.6L448 332.1L316 464.1L273.9 464.1L257.8 410.5C253.1 394.8 238.7 384.1 222.3 384.1C211 384.1 200.4 389.2 193.4 398L133.3 473C125 483.3 126.7 498.5 137 506.7C147.3 514.9 162.5 513.3 170.7 502.9L217.8 444.1L233 494.8C236 505 245.4 511.9 256 511.9L287.5 511.9C286.6 515 285.8 518.2 285.2 521.4L274.3 575.9L128.1 575.9C92.8 575.9 64.1 547.2 64.1 511.9L64.1 127.9zM272.1 122.5L272.1 216C272.1 229.3 282.8 240 296.1 240L389.6 240L272.1 122.5zM332.3 530.9C334.8 518.5 340.9 507.1 349.8 498.2L468.7 379.3L548.7 459.3L429.8 578.2C420.9 587.1 409.5 593.2 397.1 595.7L337.5 607.6C336.6 607.8 335.6 607.9 334.6 607.9C326.6 607.9 320 601.4 320 593.3C320 592.3 320.1 591.4 320.3 590.4L332.2 530.8zM600.1 407.9L571.3 436.7L491.3 356.7L520.1 327.9C542.2 305.8 578 305.8 600.1 327.9C622.2 350 622.2 385.8 600.1 407.9z" />
              </svg>
            )}
            {isDev && item.source === 'user' && item.email && (
              <>
                {window.location.hostname === 'pipetooling.com' && (
                  <button
                    type="button"
                    title="imitate (pipetooling.com)"
                    onClick={async () => {
                      setLoggingInAsId(item.id)
                      setError(null)
                      try {
                        await loginAsUser(item, 'https://pipetooling.com/dashboard')
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed to imitate')
                      } finally {
                        setLoggingInAsId(null)
                      }
                    }}
                    disabled={loggingInAsId === item.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: 0,
                      marginRight: '0.35rem',
                      background: 'none',
                      border: 'none',
                      cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer',
                      verticalAlign: 'middle',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                      <path d="M96 64C60.7 64 32 92.7 32 128L32 200C32 213.3 42.7 224 56 224C69.3 224 80 213.3 80 200L80 128C80 119.2 87.2 112 96 112L168 112C181.3 112 192 101.3 192 88C192 74.7 181.3 64 168 64L96 64zM472 64C458.7 64 448 74.7 448 88C448 101.3 458.7 112 472 112L544 112C552.8 112 560 119.2 560 128L560 200C560 213.3 570.7 224 584 224C597.3 224 608 213.3 608 200L608 128C608 92.7 579.3 64 544 64L472 64zM80 440C80 426.7 69.3 416 56 416C42.7 416 32 426.7 32 440L32 512C32 547.3 60.7 576 96 576L168 576C181.3 576 192 565.3 192 552C192 538.7 181.3 528 168 528L96 528C87.2 528 80 520.8 80 512L80 440zM608 440C608 426.7 597.3 416 584 416C570.7 416 560 426.7 560 440L560 512C560 520.8 552.8 528 544 528L472 528C458.7 528 448 538.7 448 552C448 565.3 458.7 576 472 576L544 576C579.3 576 608 547.3 608 512L608 440zM320 280C350.9 280 376 254.9 376 224C376 193.1 350.9 168 320 168C289.1 168 264 193.1 264 224C264 254.9 289.1 280 320 280zM320 320C267 320 224 363 224 416L224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440L416 416C416 363 373 320 320 320zM512 256C512 229.5 490.5 208 464 208C437.5 208 416 229.5 416 256C416 282.5 437.5 304 464 304C490.5 304 512 282.5 512 256zM200 336.3C150.7 340.4 112 381.6 112 432L112 442.7C112 454.5 121.6 464 133.3 464L180.1 464C177.4 456.5 176 448.4 176 440L176 416C176 386.5 184.8 359.1 200 336.3zM459.9 464L506.7 464C518.5 464 528 454.4 528 442.7L528 432C528 381.7 489.3 340.4 440 336.3C455.2 359.1 464 386.5 464 416L464 440C464 448.4 462.6 456.5 459.9 464zM224 256C224 229.5 202.5 208 176 208C149.5 208 128 229.5 128 256C128 282.5 149.5 304 176 304C202.5 304 224 282.5 224 256z" />
                    </svg>
                  </button>
                )}
                {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                  <button
                    type="button"
                    title="imitate (localhost)"
                    onClick={async () => {
                      setLoggingInAsId(item.id)
                      setError(null)
                      try {
                        await loginAsUser(item, 'http://localhost:5173/dashboard')
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed to imitate')
                      } finally {
                        setLoggingInAsId(null)
                      }
                    }}
                    disabled={loggingInAsId === item.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: 0,
                      marginRight: '0.35rem',
                      background: 'none',
                      border: 'none',
                      cursor: loggingInAsId === item.id ? 'not-allowed' : 'pointer',
                      verticalAlign: 'middle',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                      <path d="M31 31C21.7 40.4 21.7 55.6 31 65L87 121C96.4 130.4 111.6 130.4 120.9 121C130.2 111.6 130.3 96.4 120.9 87.1L65 31C55.6 21.6 40.4 21.6 31.1 31zM609 31C599.6 21.6 584.4 21.6 575.1 31L519 87C509.6 96.4 509.6 111.6 519 120.9C528.4 130.2 543.6 130.3 552.9 120.9L609 65C618.4 55.6 618.4 40.4 609 31.1zM65 609L121 553C130.4 543.6 130.4 528.4 121 519.1C111.6 509.8 96.4 509.7 87.1 519.1L31 575C21.6 584.4 21.6 599.6 31 608.9C40.4 618.2 55.6 618.3 64.9 608.9zM609 609C618.4 599.6 618.4 584.4 609 575.1L553 519.1C543.6 509.7 528.4 509.7 519.1 519.1C509.8 528.5 509.7 543.7 519.1 553L575.1 609C584.5 618.4 599.7 618.4 609 609zM320 272C355.3 272 384 243.3 384 208C384 172.7 355.3 144 320 144C284.7 144 256 172.7 256 208C256 243.3 284.7 272 320 272zM320 304C258.1 304 208 354.1 208 416L208 424C208 437.3 218.7 448 232 448L408 448C421.3 448 432 437.3 432 424L432 416C432 354.1 381.9 304 320 304zM536 224C536 193.1 510.9 168 480 168C449.1 168 424 193.1 424 224C424 254.9 449.1 280 480 280C510.9 280 536 254.9 536 224zM451.2 324.4C469.4 350.3 480 381.9 480 416L480 424C480 432.4 478.6 440.5 475.9 448L554.7 448C566.5 448 576 438.4 576 426.7L576 416C576 363 533 320 480 320C470 320 460.3 321.5 451.2 324.4zM188.8 324.4C179.7 321.5 170 320 160 320C107 320 64 363 64 416L64 426.7C64 438.5 73.6 448 85.3 448L164.1 448C161.4 440.5 160 432.4 160 424L160 416C160 381.9 170.6 350.3 188.8 324.4zM216 224C216 193.1 190.9 168 160 168C129.1 168 104 193.1 104 224C104 254.9 129.1 280 160 280C190.9 280 216 254.9 216 224z" />
                    </svg>
                  </button>
                )}
              </>
            )}
            <span style={{ fontWeight: 500 }}>{item.name}</span>
            {isExternalSubRoster &&
              (activeProjectCount === 0 ? (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>0 active</span>
              ) : (
                <button
                  type="button"
                  aria-expanded={externalSubProjectsExpanded.has(item.id)}
                  aria-label={`${activeProjectCount} active projects for ${item.name}. Toggle list.`}
                  onClick={() => {
                    setExternalSubProjectsExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }}
                  style={{
                    marginLeft: '0.5rem',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'underline',
                  }}
                >
                  {activeProjectCount} active {activeProjectCount === 1 ? 'project' : 'projects'}
                </button>
              ))}
            {item.source === 'user' && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>(account)</span>
            )}
            {(item.email || item.phone) && (
              <span style={usersTabContactRowStyle(narrowViewport)}>
                {item.email && (
                  <a href={`mailto:${item.email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                    {item.email}
                  </a>
                )}
                {item.email && item.phone && ' \u00B7 '}
                {item.phone && (
                  <a href={`tel:${item.phone}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                    {item.phone}
                  </a>
                )}
              </span>
            )}
            {item.source === 'user' && 'notes' in item && item.notes && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>— {item.notes}</span>
            )}
          </div>
          {(() => {
            if (sectionKind === 'primary' || sectionKind === 'superintendent') return null
            if (isExternalSubRoster) {
              if (
                activeProjectCount > 0 &&
                externalSubProjectsExpanded.has(item.id) &&
                activeProjectRows &&
                activeProjectRows.length > 0
              ) {
                return (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Active projects:{' '}
                    {activeProjectRows.map((row, i) => (
                      <span key={row.id}>
                        {i > 0 ? ', ' : null}
                        <Link to={`/workflows/${row.id}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                          {row.name}
                        </Link>
                      </span>
                    ))}
                  </div>
                )
              }
              return null
            }
            return activeProjectRows && activeProjectRows.length > 0 ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Active projects:{' '}
                {activeProjectRows.map((row, i) => (
                  <span key={row.id}>
                    {i > 0 ? ', ' : null}
                    <Link to={`/workflows/${row.id}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                      {row.name}
                    </Link>
                  </span>
                ))}
              </div>
            ) : null
          })()}
          {isDev && usersTabTags.showUsersTabTags && (
            <PeopleUserTagsPanel
              anchor={resolveUsersTabTagAnchor(
                { source: item.source, id: item.id, email: item.email },
                sectionKind,
              )}
              people={people}
              tags={usersTabTags}
              showToast={showToast}
            />
          )}
        </div>
        {item.source === 'people' && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {!isAlreadyUser(item.email) && (
              <button
                type="button"
                onClick={() => setInviteConfirm(item as Person)}
                disabled={!item.email?.trim() || invitingId === item.id}
                title={!item.email?.trim() ? 'Add email in Edit to invite' : undefined}
                style={{ padding: '2px 6px', fontSize: '0.8125rem' }}
              >
                {invitingId === item.id ? 'Sending…' : 'Invite as user'}
              </button>
            )}
            <button type="button" onClick={() => openEdit(item as Person)} style={{ padding: '2px 6px', fontSize: '0.8125rem' }}>
              Edit
            </button>
            {/* Owner always; devs on anyone's row (RLS: "Devs can update any people"). */}
            {(item.master_user_id === authUserId || isDev) && (
              <button
                type="button"
                onClick={() => {
                  setLinkTarget(item as Person)
                  setLinkUserId('')
                }}
                title="Link this person to an app account so only one row shows"
                style={{ padding: '2px 6px', fontSize: '0.8125rem' }}
              >
                Link account
              </button>
            )}
            {(item.master_user_id === authUserId || isDev) && (
              <button
                type="button"
                onClick={() => setCombineSource(item as Person)}
                title="Fold this duplicate identity into another person — hours, pay, crew records, and sub sheets move; this row is archived"
                style={{ padding: '2px 6px', fontSize: '0.8125rem' }}
              >
                Combine…
              </button>
            )}
            {/* Owner always; devs on anyone's row (RLS: "Devs can update any people"). */}
            {(item.master_user_id === authUserId || isDev) && (
              <button
                type="button"
                onClick={() => archivePerson(item.id)}
                disabled={archivingId === item.id}
                style={{ padding: '2px 6px', fontSize: '0.8125rem', color: 'var(--text-red-700)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 3 }}
              >
                {archivingId === item.id ? '...' : 'Archive'}
              </button>
            )}
            {item.master_user_id !== authUserId && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Created by {creatorNames[item.master_user_id] ?? 'Unknown'}
              </span>
            )}
          </div>
        )}
        {item.source === 'user' && canEditUserNotes && (
          <button
            type="button"
            title="Update full name, title, and phone"
            aria-label="Update full name, title, and phone"
            onClick={() =>
              setEditingUserNote({
                id: item.id,
                name: item.name,
                notes: ('notes' in item ? item.notes : null) ?? '',
                phone: ('phone' in item ? item.phone : null) ?? '',
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
              <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
            </svg>
          </button>
        )}
      </li>
    )
  }

  return (
    <>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ marginBottom: '1.25rem', width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="search"
          value={usersTabSearch}
          onChange={(e) => setUsersTabSearch(e.target.value)}
          placeholder="Search by name, email, phone…"
          aria-label="Search people on Users tab"
          style={{
            flex: 1,
            padding: '0.3rem 0.65rem',
            fontSize: '0.875rem',
            lineHeight: 1.35,
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
        />
        {onOpenActiveAccounts && (
          <button
            type="button"
            onClick={onOpenActiveAccounts}
            className="activeAccountsCard__btnSecondary"
            style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem' }}
          >
            Manage accounts
          </button>
        )}
      </div>
      {usersTabSearchShowsNoSections ? (
        <p role="status" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
          No matches.
        </p>
      ) : null}
      {USERS_TAB_SECTIONS.map((sec) => {
        if (sec.type === 'dev') {
          if (!isDev) return null
          if (usersTabSearchQ && !usersTabSectionHasVisibleRows(sec)) return null
          return (
            <section key="users-tab-devs" style={{ marginBottom: '2rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Devs</h2>
              {(() => {
                const devUsersAll = users.filter((u) => u.role === 'dev')
                if (devUsersAll.length === 0) {
                  return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                }
                const devUsersFiltered = usersTabSearchQ
                  ? devUsersAll.filter((u) => usersTabRowMatchesSearch(u, usersTabSearchQ))
                  : devUsersAll
                return (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {devUsersFiltered
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((u) => {
                        const contractsSigningLight = contractSigningStatusByPersonName[u.name]
                        return (
                          <li
                            key={u.id}
                            style={{
                              padding: '0.5rem 0',
                              borderBottom: '1px solid var(--border)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: narrowViewport ? 'flex-start' : 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div>
                                {pushEnabledUserIds.has(u.id) && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    width={14}
                                    height={14}
                                    fill="#22c55e"
                                    role="img"
                                    aria-hidden
                                    style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
                                  >
                                    <title>Push notifications enabled</title>
                                    <path d="M320 64C302.3 64 288 78.3 288 96L288 99.2C215 114 160 178.6 160 256L160 277.7C160 325.8 143.6 372.5 113.6 410.1L103.8 422.3C98.7 428.6 96 436.4 96 444.5C96 464.1 111.9 480 131.5 480L508.4 480C528 480 543.9 464.1 543.9 444.5C543.9 436.4 541.2 428.6 536.1 422.3L526.3 410.1C496.4 372.5 480 325.8 480 277.7L480 256C480 178.6 425 114 352 99.2L352 96C352 78.3 337.7 64 320 64zM258 528C265.1 555.6 290.2 576 320 576C349.8 576 374.9 555.6 382 528L258 528z" />
                                  </svg>
                                )}
                                {locationEnabledUserIds.has(u.id) && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    width={14}
                                    height={14}
                                    fill="#22c55e"
                                    role="img"
                                    aria-hidden
                                    style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
                                  >
                                    <title>Location service enabled</title>
                                    <path d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z" />
                                  </svg>
                                )}
                                {canAccessContracts && contractsSigningLight && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    width={14}
                                    height={14}
                                    fill={
                                      contractsSigningLight === 'green'
                                        ? '#22c55e'
                                        : contractsSigningLight === 'yellow'
                                          ? '#eab308'
                                          : '#ef4444'
                                    }
                                    role="img"
                                    aria-hidden
                                    style={{ display: 'inline-block', marginRight: '0.35rem', verticalAlign: 'middle' }}
                                  >
                                    <title>{contractSigningIconTitle(contractsSigningLight)}</title>
                                    <path d="M64.1 128C64.1 92.7 92.8 64 128.1 64L277.6 64C294.6 64 310.9 70.7 322.9 82.7L429.3 189.3C441.3 201.3 448 217.6 448 234.6L448 332.1L316 464.1L273.9 464.1L257.8 410.5C253.1 394.8 238.7 384.1 222.3 384.1C211 384.1 200.4 389.2 193.4 398L133.3 473C125 483.3 126.7 498.5 137 506.7C147.3 514.9 162.5 513.3 170.7 502.9L217.8 444.1L233 494.8C236 505 245.4 511.9 256 511.9L287.5 511.9C286.6 515 285.8 518.2 285.2 521.4L274.3 575.9L128.1 575.9C92.8 575.9 64.1 547.2 64.1 511.9L64.1 127.9zM272.1 122.5L272.1 216C272.1 229.3 282.8 240 296.1 240L389.6 240L272.1 122.5zM332.3 530.9C334.8 518.5 340.9 507.1 349.8 498.2L468.7 379.3L548.7 459.3L429.8 578.2C420.9 587.1 409.5 593.2 397.1 595.7L337.5 607.6C336.6 607.8 335.6 607.9 334.6 607.9C326.6 607.9 320 601.4 320 593.3C320 592.3 320.1 591.4 320.3 590.4L332.2 530.8zM600.1 407.9L571.3 436.7L491.3 356.7L520.1 327.9C542.2 305.8 578 305.8 600.1 327.9C622.2 350 622.2 385.8 600.1 407.9z" />
                                  </svg>
                                )}
                                <span style={{ fontWeight: 500 }}>{u.name}</span>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>(account)</span>
                                {(u.email || u.phone) && (
                                  <span style={usersTabContactRowStyle(narrowViewport)}>
                                    {u.email && (
                                      <a href={`mailto:${u.email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                                        {u.email}
                                      </a>
                                    )}
                                    {u.email && u.phone && ' \u00B7 '}
                                    {u.phone && (
                                      <a href={`tel:${u.phone}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                                        {u.phone}
                                      </a>
                                    )}
                                  </span>
                                )}
                                {u.notes && (
                                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>— {u.notes}</span>
                                )}
                              </div>
                              {isDev && usersTabTags.showUsersTabTags && (
                                <PeopleUserTagsPanel
                                  anchor={resolveUsersTabTagAnchor({ source: 'user', id: u.id, email: u.email }, null)}
                                  people={people}
                                  tags={usersTabTags}
                                  showToast={showToast}
                                />
                              )}
                            </div>
                            {canEditUserNotes && (
                              <button
                                type="button"
                                title="Update full name, title, and phone"
                                aria-label="Update full name, title, and phone"
                                onClick={() => setEditingUserNote({ id: u.id, name: u.name, notes: u.notes ?? '', phone: u.phone ?? '' })}
                                style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', verticalAlign: 'middle' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                  <path d="M32 160C32 124.7 60.7 96 96 96L544 96C579.3 96 608 124.7 608 160L32 160zM32 208L608 208L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 208zM279.3 480C299.5 480 314.6 460.6 301.7 445C287 427.3 264.8 416 240 416L176 416C151.2 416 129 427.3 114.3 445C101.4 460.6 116.5 480 136.7 480L279.2 480zM208 376C238.9 376 264 350.9 264 320C264 289.1 238.9 264 208 264C177.1 264 152 289.1 152 320C152 350.9 177.1 376 208 376zM392 272C378.7 272 368 282.7 368 296C368 309.3 378.7 320 392 320L504 320C517.3 320 528 309.3 528 296C528 282.7 517.3 272 504 272L392 272zM392 368C378.7 368 368 378.7 368 392C368 405.3 378.7 416 392 416L504 416C517.3 416 528 405.3 528 392C528 378.7 517.3 368 504 368L392 368z" />
                                </svg>
                              </button>
                            )}
                          </li>
                        )
                      })}
                  </ul>
                )
              })()}
            </section>
          )
        }
        if (sec.type === 'personKind') {
          const k = sec.kind
          if (usersTabSearchQ && !usersTabSectionHasVisibleRows(sec)) return null
          return (
            <section key={`users-tab-kind-${k}`} style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{KIND_LABELS[k]}</h2>
                {canCreatePeopleInRoster ? (
                  <button type="button" onClick={() => openAdd(k)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                    Add
                  </button>
                ) : null}
              </div>
              {(() => {
                const usersTabRosterUlStyle = { listStyle: 'none' as const, padding: 0, margin: 0 }
                if (k === 'sub') {
                  const subItems = byKind('sub')
                  if (subItems.length === 0) {
                    return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                  }
                  const withAccount = subItems.filter((i) => i.source === 'user')
                  const external = subItems.filter((i) => i.source === 'people')
                  const withAccountF = usersTabSearchQ
                    ? withAccount.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                    : withAccount
                  const externalF = usersTabSearchQ
                    ? external.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                    : external
                  return (
                    <>
                      {withAccountF.length > 0 ? (
                        <ul style={usersTabRosterUlStyle}>
                          {withAccountF.map((item) => renderUsersTabRosterListItem('sub', item))}
                        </ul>
                      ) : null}
                      {externalF.length > 0 ? (() => {
                        // Searching force-opens the list so matches are never hidden by the collapse.
                        const externalOpen = externalSubsExpanded || Boolean(usersTabSearchQ)
                        return (
                          <>
                            <button
                              type="button"
                              aria-expanded={externalOpen}
                              aria-controls="users-tab-external-subs-panel"
                              onClick={() => setExternalSubsExpanded((v) => !v)}
                              style={{
                                margin: withAccountF.length > 0 ? '1rem 0 0.5rem 0' : '0 0 0.5rem 0',
                                padding: 0,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              <span aria-hidden style={{ fontSize: '0.875rem' }}>
                                {externalOpen ? '▼' : '▶'}
                              </span>
                              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
                                External Subcontractors ({externalF.length})
                              </h3>
                            </button>
                            {externalOpen ? (
                              <ul id="users-tab-external-subs-panel" style={usersTabRosterUlStyle}>
                                {externalF.map((item) => renderUsersTabRosterListItem('sub', item))}
                              </ul>
                            ) : null}
                          </>
                        )
                      })() : null}
                    </>
                  )
                }
                if (k === 'helper') {
                  const helperItems = byKind('helper')
                  if (helperItems.length === 0) {
                    return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                  }
                  const withAccount = helperItems.filter((i) => i.source === 'user')
                  const external = helperItems.filter((i) => i.source === 'people')
                  const withAccountF = usersTabSearchQ
                    ? withAccount.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                    : withAccount
                  const externalF = usersTabSearchQ
                    ? external.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                    : external
                  return (
                    <>
                      {withAccountF.length > 0 ? (
                        <ul style={usersTabRosterUlStyle}>
                          {withAccountF.map((item) => renderUsersTabRosterListItem('helper', item))}
                        </ul>
                      ) : null}
                      {externalF.length > 0 ? (
                        <>
                          <h3
                            style={{
                              margin: withAccountF.length > 0 ? '1rem 0 0.5rem 0' : '0 0 0.5rem 0',
                              fontSize: '1.125rem',
                              fontWeight: 700,
                            }}
                          >
                            External Helpers
                          </h3>
                          <ul style={usersTabRosterUlStyle}>
                            {externalF.map((item) => renderUsersTabRosterListItem('helper', item))}
                          </ul>
                        </>
                      ) : null}
                    </>
                  )
                }
                const kindItems = byKind(k)
                if (kindItems.length === 0) {
                  return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>None yet.</p>
                }
                const kindItemsF = usersTabSearchQ
                  ? kindItems.filter((i) => usersTabRowMatchesSearch(i, usersTabSearchQ))
                  : kindItems
                return (
                  <ul style={usersTabRosterUlStyle}>
                    {kindItemsF.map((item) => renderUsersTabRosterListItem(k, item))}
                  </ul>
                )
              })()}
            </section>
          )
        }
        return null
      })}

      {/* Archived people */}
      <div style={{ marginTop: '2rem', maxWidth: 640 }}>
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
