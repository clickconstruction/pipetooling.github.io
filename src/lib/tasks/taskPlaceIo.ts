/**
 * Reads for a task's place (punch list #328, PR 2). The columns are younger than the generated
 * types, hence the cast; the types PR after the push removes it. Each read stands alone, so a read
 * that fails costs the chips or the place and never the window that asked.
 */
import { supabase } from '../supabase'
import { TASK_PLACE_SELECT, recentTaskPlaces, taskPlaceFromRow, type TaskPlace, type TaskPlaceColumns } from './taskPlace'

type PlaceRead = { data: Array<Partial<TaskPlaceColumns>> | null; error: { message: string } | null }

/** How many placed tasks to read for the chips. Places repeat, so a few hundred tasks hold every name in use. */
const RECENT_READ_LIMIT = 300

/**
 * The places tasks already carry, one a name, newest first: the chips under Assign to. There is no
 * list of places to keep. A place is offered because a task has it, and RLS decides which tasks
 * this person may read. A failed read is no chips.
 */
export async function loadRecentTaskPlaces(limit = 8): Promise<TaskPlace[]> {
  try {
    const res = (await supabase
      .from('checklist_items')
      .select(TASK_PLACE_SELECT as '*')
      .not('place_lat' as 'id', 'is', null)
      .order('place_set_at' as 'id', { ascending: false })
      .limit(RECENT_READ_LIMIT)) as unknown as PlaceRead
    if (res.error || !res.data) return []
    return recentTaskPlaces(res.data, limit)
  } catch {
    return []
  }
}

/** One task's place, for the Edit window. Null for a task with none, and for a read that failed. */
export async function loadTaskPlace(itemId: string): Promise<TaskPlace | null> {
  try {
    const res = (await supabase
      .from('checklist_items')
      .select(TASK_PLACE_SELECT as '*')
      .eq('id', itemId)
      .limit(1)) as unknown as PlaceRead
    if (res.error || !res.data) return null
    return taskPlaceFromRow(res.data[0] ?? null)
  } catch {
    return null
  }
}

/**
 * The places of the tasks on a screen, by task id (PR 3). Its own read, beside the day's read and
 * never inside it, so a place that cannot be read costs the place line and never the list. Tasks
 * with no place are simply absent.
 */
export async function loadTaskPlacesForItems(itemIds: ReadonlyArray<string>): Promise<Map<string, TaskPlace>> {
  const out = new Map<string, TaskPlace>()
  const ids = [...new Set(itemIds.filter(Boolean))]
  if (ids.length === 0) return out
  try {
    const res = (await supabase
      .from('checklist_items')
      .select(`id,${TASK_PLACE_SELECT}` as '*')
      .in('id', ids)
      .not('place_lat' as 'id', 'is', null)) as unknown as { data: Array<Partial<TaskPlaceColumns> & { id: string }> | null; error: { message: string } | null }
    if (res.error || !res.data) return out
    for (const row of res.data) {
      const place = taskPlaceFromRow(row)
      if (place) out.set(row.id, place)
    }
  } catch {
    // No places; the list stands.
  }
  return out
}
