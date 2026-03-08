import { supabase } from './supabase'

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
 * Cascade a person name change to all Pay-related tables so /people Pay tab shows updated names.
 * Call this when updating users.name or people.name in Settings or People.
 */
export async function cascadePersonNameInPayTables(oldName: string, newName: string): Promise<void> {
  const trimmedOld = oldName?.trim()
  const trimmedNew = newName?.trim()
  if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return
  await Promise.all([
    supabase.from('people_pay_config').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    supabase.from('people_hours').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    supabase.from('people_team_members').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    supabase.from('people_cost_matrix_tags').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    supabase.from('people_hours_display_order').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    supabase.from('people_crew_jobs').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    supabase.from('people_crew_jobs').update({ crew_lead_person_name: trimmedNew }).eq('crew_lead_person_name', trimmedOld),
    supabase.from('pay_stubs').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
    supabase.from('pay_stub_days').update({ person_name: trimmedNew }).eq('person_name', trimmedOld),
  ])
}
