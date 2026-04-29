import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

const OFFSET_USER_ROLES = ['assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'] as const

export type FetchOffsetPersonNameOptionsArgs = {
  authUserId: string
  /** Merged into the set so prefilled names always appear in the dropdown */
  ensureNames?: string[] | null
}

function addNonEmptyName(set: Set<string>, raw: string | null | undefined): void {
  const t = raw?.trim() ?? ''
  if (t !== '') set.add(t)
}

/**
 * Same name union as People → Offsets (people + users by role + dev users when viewer is dev).
 */
export async function fetchOffsetPersonNameOptions({
  authUserId,
  ensureNames,
}: FetchOffsetPersonNameOptionsArgs): Promise<string[]> {
  const [peopleRows, usersRows, meRow] = await Promise.all([
    withSupabaseRetry(
      async () => supabase.from('people').select('name').is('archived_at', null),
      'offset person names: people',
    ),
    withSupabaseRetry(
      async () =>
        supabase
          .from('users')
          .select('id, name')
          .is('archived_at', null)
          .in('role', [...OFFSET_USER_ROLES]),
      'offset person names: users',
    ),
    withSupabaseRetry(
      async () => supabase.from('users').select('role').eq('id', authUserId).single(),
      'offset person names: me',
    ),
  ])

  const names = new Set<string>()
  for (const p of peopleRows ?? []) {
    addNonEmptyName(names, (p as { name?: string | null }).name)
  }

  type UserRow = { id: string; name: string | null }
  let usersList = (usersRows ?? []) as UserRow[]
  const myRole = (meRow as { role?: string } | null)?.role ?? null

  if (myRole === 'dev') {
    const devUsers = await withSupabaseRetry(
      async () => supabase.from('users').select('id, name').is('archived_at', null).eq('role', 'dev'),
      'offset person names: dev users',
    )
    if (devUsers && devUsers.length > 0) {
      const existingIds = new Set(usersList.map((u) => u.id))
      const extraDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
      usersList = [...usersList, ...extraDevs]
    }
  }

  for (const u of usersList) {
    addNonEmptyName(names, u.name)
  }

  for (const raw of ensureNames ?? []) {
    addNonEmptyName(names, raw)
  }

  return [...names].sort((a, b) => a.localeCompare(b))
}
