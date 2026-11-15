/**
 * Reads for a painted map on a task (punch list #345, "A map on a task"). Each read stands alone,
 * so a read that fails costs the map and never the window that asked.
 */
import { supabase } from '../supabase'
import { taskMapIdFromRow } from './taskMap'

type MapRead = { data: Array<{ place_lat?: number | null; place_lng?: number | null; painted_map_id?: string | null }> | null; error: { message: string } | null }

/**
 * The painted map one task carries with no place, for the Edit window. Null for a task with none,
 * for a task with a place (its map is then that place's way in and rides on the place), and for a
 * read that failed.
 */
export async function loadTaskMapAlone(itemId: string): Promise<string | null> {
  try {
    const res = (await supabase.from('checklist_items').select('place_lat,place_lng,painted_map_id').eq('id', itemId).limit(1)) as unknown as MapRead
    if (res.error || !res.data) return null
    return taskMapIdFromRow(res.data[0] ?? null)
  } catch {
    return null
  }
}
