import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

/**
 * The name the app has for one person, as the Lien desk's rows print a job's leader. For an opener of the Lien
 * window that holds no list of people (`useJobLienDeskEntry`): the Pipeline and the Lien desk page read the
 * name off the people they already hold. Blank when there is no id, no row or no name; a failed read is blank
 * too, and the header then reads *the leader*, as it did.
 */
export async function readLienLeaderName(userId: string | null | undefined): Promise<string> {
  if (!userId) return ''
  try {
    const row = await withSupabaseRetry<{ name: string | null } | null>(() => supabase.from('users').select('name').eq('id', userId).maybeSingle(), 'lien window: the leader’s name')
    return row?.name?.trim() ?? ''
  } catch {
    return ''
  }
}
