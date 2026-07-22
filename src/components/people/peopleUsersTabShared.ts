import type { CSSProperties } from 'react'
import type { Person, PersonKind, UserRow } from '../../hooks/usePeopleRoster'

export const KINDS: PersonKind[] = [
  'master_technician',
  'assistant',
  'controller',
  'primary',
  'estimator',
  'superintendent',
  'sub',
  'helper',
]

export const KIND_LABELS: Record<PersonKind, string> = {
  assistant: 'Assistants',
  controller: 'Controllers',
  master_technician: 'Master Technicians',
  sub: 'Subcontractors',
  helper: 'Helper',
  estimator: 'Estimators',
  primary: 'Primaries',
  superintendent: 'Superintendents',
}

export const KIND_TO_USER_ROLE: Record<PersonKind, string> = {
  assistant: 'assistant',
  controller: 'controller',
  master_technician: 'master_technician',
  sub: 'subcontractor',
  helper: 'helpers',
  estimator: 'estimator',
  primary: 'primary',
  superintendent: 'superintendent',
}

/** Display order for People → Users tab sections (master roster + user-only roles + devs last). */
export type UsersTabSection = { type: 'personKind'; kind: PersonKind } | { type: 'dev' }

export const USERS_TAB_SECTIONS: UsersTabSection[] = [
  { type: 'personKind', kind: 'master_technician' },
  { type: 'personKind', kind: 'assistant' },
  { type: 'personKind', kind: 'controller' },
  { type: 'personKind', kind: 'primary' },
  { type: 'personKind', kind: 'estimator' },
  { type: 'personKind', kind: 'superintendent' },
  { type: 'personKind', kind: 'sub' },
  { type: 'personKind', kind: 'helper' },
  { type: 'dev' },
]

export function usersTabContactRowStyle(narrow: boolean): CSSProperties {
  return narrow
    ? {
        display: 'block',
        fontSize: '0.875rem',
        color: 'var(--text-muted)',
        marginLeft: 0,
        marginTop: '0.25rem',
      }
    : {
        fontSize: '0.875rem',
        color: 'var(--text-muted)',
        marginLeft: '0.5rem',
      }
}

export function usersTabRowMatchesSearch(
  fields: {
    name: string
    email: string | null | undefined
    phone: string | null | undefined
    notes: string | null | undefined
  },
  q: string,
): boolean {
  if (!q) return true
  const hay = [fields.name ?? '', fields.email ?? '', fields.phone ?? '', fields.notes ?? '']
    .join('\n')
    .toLowerCase()
  return hay.includes(q)
}

function isAlreadyUserEmail(email: string | null, users: UserRow[]): boolean {
  if (!email?.trim()) return false
  const e = email.trim().toLowerCase()
  return users.some((u) => u.email && u.email.toLowerCase() === e)
}

/** Merge the user-account rows and external people rows for a roster kind, sorted by name. */
export function buildUsersTabKindRoster(k: PersonKind, users: UserRow[], people: Person[]) {
  const userRole = KIND_TO_USER_ROLE[k]
  const fromUsers = users
    .filter((u) => u.role === userRole)
    .map((u) => ({
      source: 'user' as const,
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      notes: u.notes,
    }))
  const liveUserIds = new Set(users.map((u) => u.id))
  const fromPeople = people
    .filter(
      (p) =>
        p.kind === k &&
        !isAlreadyUserEmail(p.email, users) &&
        // A person linked to a live account folds into that account's row.
        !(p.account_user_id && liveUserIds.has(p.account_user_id)),
    )
    .map((p) => ({ source: 'people' as const, ...p }))
  return [...fromUsers, ...fromPeople].sort((a, b) => a.name.localeCompare(b.name))
}

export type UsersTabRosterListRow = ReturnType<typeof buildUsersTabKindRoster>[number]
