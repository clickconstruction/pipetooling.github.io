/**
 * GC mode, the real build, the Building lane's U6d: where the punch list is read (`gc_punch_items`, dev only while
 * Building is built). The Closeout window reads it to hold Accept the work. U3b adds the punch list's presses here.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { PUNCH_COLUMNS, type PunchRow } from './punchRows'

/** The punch items on these jobs. */
export async function loadGcPunch(projectIds: string[]): Promise<PunchRow[]> {
  if (projectIds.length === 0) return []
  const result = await supabase.from('gc_punch_items').select(PUNCH_COLUMNS).in('project_id', projectIds)
  checkSupabaseError(result, 'load the punch list')
  return result.data ?? []
}
