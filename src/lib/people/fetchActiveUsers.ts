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
  /**
   * Punch list #260 (v2.6519): only people who can sign in (`login_attached_at` set). For the pickers that hand someone an
   * app task, a pin or an imitation — dead for a worker with no login. Rosters, crews and pay lists leave it off.
   */
  withLogin?: boolean
}

/** Default row shape for the common `'id, name, email, role'`-style pickers; pass your own `T` for wider selects. */
export type ActiveUserRow = { id: string; name: string | null; email: string | null; role: string | null }

/**
 * The one "active people" query (Tier-2 #19): `users` rows that are not
 * archived, not digital twins and not sample accounts, dev rows only when the caller says so.
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
  // `withLogin` reads the column and drops the rows here, so the query's shape (and every picker's test mock) stays as it was.
  const selected = opts.withLogin && !/\blogin_attached_at\b/.test(columns) ? `${columns}, login_attached_at` : columns
  let q = supabase
    .from('users')
    .select(selected)
    .is('archived_at', null)
    .eq('is_digital_twin', false)
    .eq('is_sample', false) // v2.3606: the View-as sample accounts hide like twins
    .eq('is_walk_tester', false) // v2.5738: the walk kit's tester hides like a sample
  if (opts.roles) {
    const roles = opts.includeDev ? [...opts.roles, 'dev'] : [...opts.roles]
    q = q.in('role', roles as unknown as UserRoleEnum[])
  } else if (!opts.includeDev) {
    q = q.neq('role', 'dev' as UserRoleEnum)
  }
  if (opts.orderByName !== false) q = q.order('name')
  const built = q as unknown as PromiseLike<SupabaseClientResult<T[]>>
  if (!opts.withLogin) return built
  return {
    then<R1 = SupabaseClientResult<T[]>, R2 = never>(
      onOk?: ((value: SupabaseClientResult<T[]>) => R1 | PromiseLike<R1>) | null,
      onErr?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
    ): PromiseLike<R1 | R2> {
      return built.then((r) => {
        const rows = (r.data ?? null) as Array<T & { login_attached_at?: string | null }> | null
        // A row the read did not stamp (a mock, an older reader) keeps the older meaning: a login.
        const kept = rows ? rows.filter((u) => u.login_attached_at !== null) : rows
        return onOk ? onOk({ ...r, data: kept as T[] | null } as SupabaseClientResult<T[]>) : ((r as unknown) as R1)
      }, onErr)
    },
  }
}

/** `activeUsersQuery` awaited: `{ data: T[], error }`, never a null data. */
export async function fetchActiveUsers<T extends object = ActiveUserRow>(
  columns: string,
  opts: ActiveUsersQueryOptions = {},
): Promise<{ data: T[]; error: { message: string } | null }> {
  const { data, error } = await activeUsersQuery<T>(columns, opts)
  return { data: data ?? [], error: error ? { message: error.message } : null }
}
