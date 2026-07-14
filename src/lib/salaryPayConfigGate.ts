import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * `user_id`s whose `users.name` (trim) matches `people_pay_config.person_name` (trim) with
 * `is_salary` true.
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

  const names = [...new Set(idToPayName.values())]
  if (names.length === 0) return new Set()

  const payRows = await withSupabaseRetry(
    async () =>
      supabase.rpc('list_people_pay_flags'),
    'people_pay_config is_salary for salary gate row',
  )

  const salariedNames = new Set<string>()
  for (const pr of payRows ?? []) {
    const row = pr as { person_name: string | null; is_salary: boolean | null }
    const pn = row.person_name?.trim()
    if (pn && row.is_salary === true) salariedNames.add(pn)
  }

  const out = new Set<string>()
  for (const [uid, name] of idToPayName) {
    if (salariedNames.has(name)) out.add(uid)
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
