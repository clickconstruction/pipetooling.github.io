import { supabase } from './supabase'
import { NAME_KEYED_TABLES } from './combinePeople'

/**
 * Get every pay identity belonging to this user: their users.name, plus the
 * names AND people.id of people rows linked by account (account_user_id) or
 * by email. The ids let hot-path readers query person_id-first (identity
 * Phase D) while the names keep the legacy joins working.
 */
export async function getPersonKeysForUser(
  userId: string,
  userEmail: string | null
): Promise<{ names: string[]; personIds: string[] }> {
  const names = new Set<string>()
  const personIds = new Set<string>()
  const { data: userRow } = await supabase.from('users').select('name').eq('id', userId).single()
  if (userRow?.name?.trim()) names.add(userRow.name.trim())
  // Emails go double-quoted inside or() so @/. never trip the filter parser;
  // an email containing a quote (never in practice) falls back to account-only.
  const email = userEmail?.trim()
  const emailSafe = email && !email.includes('"') ? email : null
  const peopleQuery = supabase.from('people').select('id, name')
  const { data: peopleRows } = await (emailSafe
    ? peopleQuery.or(`account_user_id.eq.${userId},email.ilike."${emailSafe}"`)
    : peopleQuery.eq('account_user_id', userId))
  for (const r of peopleRows ?? []) {
    const row = r as { id: string; name: string | null }
    const name = row.name?.trim()
    if (name) names.add(name)
    if (row.id) personIds.add(row.id)
  }
  return { names: Array.from(names), personIds: Array.from(personIds) }
}

/**
 * Get all person_name values that belong to this user (by account link or email).
 * Used when editing user name in Settings to cascade all variants to the new name.
 */
export async function getPersonNamesForUser(
  userId: string,
  userEmail: string | null
): Promise<string[]> {
  const { names } = await getPersonKeysForUser(userId, userEmail)
  return names
}

/**
 * Cascade a person name change to all Pay-related tables so People → Hours (pay config / matrix) shows updated names.
 * Call this when updating users.name or people.name in Settings or People.
 *
 * Loops over the shared NAME_KEYED_TABLES inventory (combinePeople.ts, pinned
 * by its tests against the Phase B/B2 migrations) — until v2.1112 this file
 * kept its own eight-table copy, so plain renames orphaned `person_offsets`
 * and `hours_reviewed` rows under the old name.
 */
export async function cascadePersonNameInPayTables(oldName: string, newName: string): Promise<void> {
  const trimmedOld = oldName?.trim()
  const trimmedNew = newName?.trim()
  if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return
  await Promise.all(
    NAME_KEYED_TABLES.map((table) =>
      supabase.from(table).update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    ),
  )
}
