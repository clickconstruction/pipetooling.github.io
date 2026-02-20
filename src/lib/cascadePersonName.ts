import { supabase } from './supabase'

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
  ])
}
