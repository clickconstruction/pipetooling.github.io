/**
 * Auth `users.role` section order and labels aligned with People → Users (account roster only).
 * Quickfill Schedule and similar UIs can group rows without duplicating People’s section order.
 */

export const AUTH_USER_ROLE_SECTION_ORDER = [
  'master_technician',
  'assistant',
  'primary',
  'estimator',
  'superintendent',
  'subcontractor',
  'dev',
] as const

export type AuthUserRoleSectionKey = (typeof AUTH_USER_ROLE_SECTION_ORDER)[number]

export const AUTH_USER_ROLE_SECTION_LABEL: Record<AuthUserRoleSectionKey, string> = {
  master_technician: 'Master Technicians',
  assistant: 'Assistants',
  primary: 'Primaries',
  estimator: 'Estimators',
  superintendent: 'Superintendents',
  subcontractor: 'Subcontractors',
  dev: 'Devs',
}

const OTHER_SECTION_KEY = '__other__'

export type RosterUserRow = { id: string; name: string }

export type AuthRoleSectionGroup = {
  sectionKey: string
  label: string
  rows: RosterUserRow[]
}

const orderSet = new Set<string>(AUTH_USER_ROLE_SECTION_ORDER)

function isAuthUserRoleSectionKey(role: string): role is AuthUserRoleSectionKey {
  return orderSet.has(role)
}

/**
 * Buckets users into role sections (People order). Omits empty sections.
 * `usersSortedByName` should already be sorted by display name (stable global order preserves per-section name order).
 * Unknown or missing `users.role` → trailing **Other** section (only if non-empty).
 */
export function groupRosterUsersByAuthRoleSection(
  usersSortedByName: RosterUserRow[],
  roleByUserId: Map<string, string>,
): AuthRoleSectionGroup[] {
  const buckets = new Map<string, RosterUserRow[]>()
  for (const role of AUTH_USER_ROLE_SECTION_ORDER) {
    buckets.set(role, [])
  }
  buckets.set(OTHER_SECTION_KEY, [])

  for (const row of usersSortedByName) {
    const raw = roleByUserId.get(row.id)?.trim() ?? ''
    const key = raw !== '' && isAuthUserRoleSectionKey(raw) ? raw : OTHER_SECTION_KEY
    buckets.get(key)!.push(row)
  }

  const out: AuthRoleSectionGroup[] = []
  for (const role of AUTH_USER_ROLE_SECTION_ORDER) {
    const rows = buckets.get(role) ?? []
    if (rows.length > 0) {
      out.push({ sectionKey: role, label: AUTH_USER_ROLE_SECTION_LABEL[role], rows })
    }
  }
  const otherRows = buckets.get(OTHER_SECTION_KEY) ?? []
  if (otherRows.length > 0) {
    out.push({ sectionKey: OTHER_SECTION_KEY, label: 'Other', rows: otherRows })
  }
  return out
}
