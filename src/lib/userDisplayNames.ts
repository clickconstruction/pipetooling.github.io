import { supabase } from './supabase'

/**
 * Id → display-name resolution for historical references (v2.1652). The users
 * SELECT policy hides archived rows from non-dev viewers, so any surface that
 * labels old records by user id (team chips, possession history) must resolve
 * leftover ids through the SECURITY DEFINER `get_user_display_names` RPC
 * instead of querying `users` directly.
 */

export type UserDisplayName = {
  id: string
  name: string
  role: string
  archived: boolean
}

/** "Mario (archived)" for archived users, plain name otherwise; id stub when nameless. */
export function userDisplayLabel(n: Pick<UserDisplayName, 'id' | 'name' | 'archived'>): string {
  const base = (n.name ?? '').trim() || n.id.slice(0, 8)
  return n.archived ? `${base} (archived)` : base
}

/** Ids present in `ids` but absent from `known` — the ones needing the RPC. */
export function missingUserIds(ids: Iterable<string>, known: { has(id: string): boolean }): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || seen.has(id) || known.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export async function fetchUserDisplayNames(ids: string[]): Promise<UserDisplayName[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.rpc('get_user_display_names', { p_user_ids: ids })
  if (error) return []
  return (data ?? []) as UserDisplayName[]
}
