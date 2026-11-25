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

/** What a line reads for a person whose row holds no name. */
export const NAMELESS_PERSON = 'Someone'

/**
 * The rows of the names function folded into a map of id to plain name, for a line that names who hears or who wrote.
 * A row with no name reads `NAMELESS_PERSON`. The map handed in is not changed.
 */
export function withPlainNames(known: Readonly<Record<string, string>>, rows: ReadonlyArray<Pick<UserDisplayName, 'id' | 'name'>>): Record<string, string> {
  const next = { ...known }
  for (const r of rows) next[r.id] = (r.name ?? '').trim() || NAMELESS_PERSON
  return next
}

/**
 * The ids of the people among the rows who have left, added to the ones known. The names function answers for a person
 * who has left, so a past line can still name them. A line that says who is told must not, since they read nothing.
 * The set handed in comes back as it is when no row adds to it.
 */
export function withArchivedIds(known: ReadonlySet<string>, rows: ReadonlyArray<Pick<UserDisplayName, 'id' | 'archived'>>): ReadonlySet<string> {
  const added = rows.filter((r) => r.archived && !known.has(r.id))
  if (added.length === 0) return known
  const next = new Set(known)
  for (const r of added) next.add(r.id)
  return next
}

/** The name of the person a line says is told: none for nobody, for a person who has left, or for a name not read yet. */
export function toldName(id: string | null | undefined, names: Readonly<Record<string, string>>, archived: ReadonlySet<string>): string | null {
  if (!id || archived.has(id)) return null
  return names[id] ?? null
}
