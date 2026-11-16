/**
 * Reads for a painted map on a task (punch list #345, "A map on a task"). Each read stands alone,
 * so a read that fails costs the map and never the window that asked.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
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

/** The painted map one roadmap task carries with no place, for its card window. Null as `loadTaskMapAlone` is. */
export async function loadRoadmapTaskMapAlone(taskId: string): Promise<string | null> {
  try {
    const res = (await supabase.from('checklist_tech_tree_group_tasks').select('place_lat,place_lng,painted_map_id').eq('id', taskId).limit(1)) as unknown as MapRead
    if (res.error || !res.data) return null
    return taskMapIdFromRow(res.data[0] ?? null)
  } catch {
    return null
  }
}

/**
 * Sets or clears a roadmap task's painted map. The card window saves each edit by itself, so this
 * is one write and its answer: null when it landed, the reason in words when it did not. The
 * database refuses a map the writer cannot open.
 */
export async function saveRoadmapTaskMap(taskId: string, mapId: string | null): Promise<string | null> {
  try {
    const { error } = await supabase.from('checklist_tech_tree_group_tasks').update({ painted_map_id: mapId } as never).eq('id', taskId)
    return error ? formatErrorMessage(error, 'The map did not save.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The map did not save.')
  }
}
