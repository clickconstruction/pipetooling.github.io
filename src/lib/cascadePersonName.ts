import { supabase } from './supabase'
import { NAME_KEYED_TABLES } from './combinePeople'

/**
 * Get all person_name values that belong to this user (by email).
 * Used when editing user name in Settings to cascade all variants to the new name.
 */
export async function getPersonNamesForUser(
  userId: string,
  userEmail: string | null
): Promise<string[]> {
  const names = new Set<string>()
  const { data: userRow } = await supabase.from('users').select('name').eq('id', userId).single()
  if (userRow?.name?.trim()) names.add(userRow.name.trim())
  if (userEmail?.trim()) {
    const { data: peopleRows } = await supabase
      .from('people')
      .select('name')
      .ilike('email', userEmail.trim())
    for (const r of peopleRows ?? []) {
      const name = (r as { name: string }).name?.trim()
      if (name) names.add(name)
    }
  }
  return Array.from(names)
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
