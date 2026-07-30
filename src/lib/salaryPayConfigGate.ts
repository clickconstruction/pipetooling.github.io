import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { buildPayFlagsIndex, type PayFlagRpcRow } from './people/payFlagsIndex'

/**
 * `user_id`s that are salaried per `list_people_pay_flags`.
 *
 * C1 (PERSON_IDENTITY_PLAN.md): resolution is person_id-FIRST — each user id
 * maps to its roster person via `people.account_user_id`, then flags resolve
 * through the shared id-first/name-fallback index — with the historical
 * trimmed-`users.name` match kept as the fallback, so a rename between pay
 * config and the users row no longer silently drops the salary flag.
 *
 * When `opts.nameByUserId` is provided, the helper skips the `users` lookup and reuses the
 * caller's already-fetched id-to-name map. Callers like Schedule Dispatch Hub fetch this map
 * a few lines earlier; passing it in removes a redundant round-trip.
 */
export async function fetchSalariedUserIdSetFromUserIds(
  userIds: string[],
  opts?: { nameByUserId?: ReadonlyMap<string, string> },
): Promise<Set<string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Set()

  const idToPayName = new Map<string, string>()
  const provided = opts?.nameByUserId
  if (provided) {
    for (const uid of unique) {
      const n = provided.get(uid)?.trim()
      if (n) idToPayName.set(uid, n)
    }
  } else {
    const usersData = await withSupabaseRetry(
      async () => supabase.from('users').select('id, name').in('id', unique),
      'users names for salary pay gate',
    )
    for (const r of usersData ?? []) {
      const row = r as { id: string; name: string | null }
      const n = row.name?.trim()
      if (n) idToPayName.set(row.id, n)
    }
  }

  const [personRows, payRows] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase.from('people').select('id, account_user_id').in('account_user_id', unique).is('archived_at', null),
      'people for salary pay gate',
    ),
    withSupabaseRetry(async () => supabase.rpc('list_people_pay_flags'), 'people_pay_config is_salary for salary gate row'),
  ])

  const personIdByUserId = new Map<string, string>()
  for (const r of personRows ?? []) {
    const row = r as { id: string; account_user_id: string | null }
    if (row.account_user_id) personIdByUserId.set(row.account_user_id, row.id)
  }

  const flags = buildPayFlagsIndex((payRows ?? []) as PayFlagRpcRow[])

  const out = new Set<string>()
  for (const uid of unique) {
    if (flags.isSalaried({ personId: personIdByUserId.get(uid), name: idToPayName.get(uid) })) {
      out.add(uid)
    }
  }
  return out
}

/** Drop salary-auto sessions for users who are no longer salaried in pay config. */
export function filterSessionsToSalariedSalaryOrigin<T extends { user_id: string; origin?: string | null }>(
  sessions: T[],
  salariedUserIds: Set<string>,
): T[] {
  return sessions.filter((s) => {
    if (s.origin !== 'salary_schedule') return true
    return salariedUserIds.has(s.user_id)
  })
}
