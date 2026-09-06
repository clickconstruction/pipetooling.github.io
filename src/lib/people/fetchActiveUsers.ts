import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import type { SupabaseClientResult } from '../../utils/errorHandling'
import type { ActiveRosterOptions } from './activeRoster'

type UserRoleEnum = Database['public']['Enums']['user_role']

export type ActiveUsersQueryOptions = Pick<ActiveRosterOptions, 'includeDev'> & {
  /**
   * Restrict to these roles (the People / Jobs roster lists). With `includeDev`
   * the dev role is unioned in — the "dev rows only for dev viewers" convention
   * those loaders already followed, now in one place.
   */
  roles?: readonly string[]
  /** Order by name (default true). */
  orderByName?: boolean
}

/** Default row shape for the common `'id, name, email, role'`-style pickers; pass your own `T` for wider selects. */
export type ActiveUserRow = { id: string; name: string | null; email: string | null; role: string | null }

/**
 * The one "active people" query (Tier-2 #19): `users` rows that are not
 * archived and not digital twins, dev rows only when the caller says so.
 * Returns the thenable builder so callers can `await` it directly or hand it
 * to `withSupabaseRetry`. The pure predicate for rows already in memory is
 * `isActiveRosterPerson` in `./activeRoster`.
 *
 * `columns` is a runtime string, so the row type is the caller's `T` (the
 * generated parser cannot type a non-literal select).
 */
export function activeUsersQuery<T extends object = ActiveUserRow>(
  columns: string,
  opts: ActiveUsersQueryOptions = {},
): PromiseLike<SupabaseClientResult<T[]>> {
  let q = supabase
    .from('users')
    .select(columns)
    .is('archived_at', null)
    .eq('is_digital_twin', false)
  if (opts.roles) {
    const roles = opts.includeDev ? [...opts.roles, 'dev'] : [...opts.roles]
    q = q.in('role', roles as unknown as UserRoleEnum[])
  } else if (!opts.includeDev) {
    q = q.neq('role', 'dev' as UserRoleEnum)
  }
  if (opts.orderByName !== false) q = q.order('name')
  return q as unknown as PromiseLike<SupabaseClientResult<T[]>>
}

/** `activeUsersQuery` awaited: `{ data: T[], error }`, never a null data. */
export async function fetchActiveUsers<T extends object = ActiveUserRow>(
  columns: string,
  opts: ActiveUsersQueryOptions = {},
): Promise<{ data: T[]; error: { message: string } | null }> {
  const { data, error } = await activeUsersQuery<T>(columns, opts)
  return { data: data ?? [], error: error ? { message: error.message } : null }
}
