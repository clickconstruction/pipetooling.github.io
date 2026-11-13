/**
 * Reads for a task's place (punch list #328, PR 2). The columns are younger than the generated
 * types, hence the cast; the types PR after the push removes it. Each read stands alone, so a read
 * that fails costs the chips or the place and never the window that asked.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { TASK_PLACE_SELECT, recentTaskPlaces, taskPlaceColumns, taskPlaceFromRow, type TaskPlace, type TaskPlaceColumns, type TaskPlaceDraft } from './taskPlace'

type PlaceRead = { data: Array<Partial<TaskPlaceColumns>> | null; error: { message: string } | null }

/** How many placed tasks to read for the chips. Places repeat, so a few hundred tasks hold every name in use. */
const RECENT_READ_LIMIT = 300

/**
 * The places tasks already carry, one a name, newest first: the chips under Assign to. There is no
 * list of places to keep. A place is offered because a task has it, and RLS decides which tasks
 * this person may read. A failed read is no chips.
 */
export async function loadRecentTaskPlaces(limit = 8): Promise<TaskPlace[]> {
  // Two reads, each on its own: a task's place and a roadmap task's (PR 5). Either may fail and the other still offers.
  const read = async (table: 'checklist_items' | 'checklist_tech_tree_group_tasks'): Promise<Array<Partial<TaskPlaceColumns>>> => {
    try {
      const res = (await supabase
        .from(table)
        .select(TASK_PLACE_SELECT as '*')
        .not('place_lat' as 'id', 'is', null)
        .order('place_set_at' as 'id', { ascending: false })
        .limit(RECENT_READ_LIMIT)) as unknown as PlaceRead
      return res.error || !res.data ? [] : res.data
    } catch {
      return []
    }
  }
  const [tasks, roadmapTasks] = await Promise.all([read('checklist_items'), read('checklist_tech_tree_group_tasks')])
  return recentTaskPlaces([...tasks, ...roadmapTasks], limit)
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
 *
 * A task that came from a roadmap keeps its place on the roadmap task (PR 5): the made row comes
 * and goes as stages unlock, and a place set on it would be lost. So a task with no place of its
 * own and a roadmap task behind it takes the roadmap task's, read second and on its own.
 */
export async function loadTaskPlacesForItems(itemIds: ReadonlyArray<string>): Promise<Map<string, TaskPlace>> {
  const out = new Map<string, TaskPlace>()
  const ids = [...new Set(itemIds.filter(Boolean))]
  if (ids.length === 0) return out
  const roadmapTaskOf = new Map<string, string>()
  let firstRead = false
  try {
    const res = (await supabase
      .from('checklist_items')
      .select(`id,roadmap_group_task_id,${TASK_PLACE_SELECT}` as '*')
      .in('id', ids)) as unknown as { data: Array<Partial<TaskPlaceColumns> & { id: string; roadmap_group_task_id?: string | null }> | null; error: { message: string } | null }
    if (!res.error && res.data) {
      firstRead = true
      for (const row of res.data) {
        const place = taskPlaceFromRow(row)
        if (place) out.set(row.id, place)
        else if (row.roadmap_group_task_id) roadmapTaskOf.set(row.id, row.roadmap_group_task_id)
      }
    }
  } catch {
    // No places of their own; the list stands.
  }
  if (!firstRead) {
    // The first read failed, perhaps on the place columns alone. The link is older than they are, so ask for it bare.
    try {
      const res = (await supabase.from('checklist_items').select('id,roadmap_group_task_id').in('id', ids).not('roadmap_group_task_id', 'is', null)) as unknown as {
        data: Array<{ id: string; roadmap_group_task_id: string | null }> | null
        error: { message: string } | null
      }
      for (const row of res.error || !res.data ? [] : res.data) if (row.roadmap_group_task_id) roadmapTaskOf.set(row.id, row.roadmap_group_task_id)
    } catch {
      return out
    }
  }
  if (roadmapTaskOf.size === 0) return out
  try {
    const res = (await supabase
      .from('checklist_tech_tree_group_tasks')
      .select(`id,${TASK_PLACE_SELECT}` as '*')
      .in('id', [...new Set(roadmapTaskOf.values())])
      .not('place_lat' as 'id', 'is', null)) as unknown as { data: Array<Partial<TaskPlaceColumns> & { id: string }> | null; error: { message: string } | null }
    if (res.error || !res.data) return out
    const byTask = new Map<string, TaskPlace>()
    for (const row of res.data) {
      const place = taskPlaceFromRow(row)
      if (place) byTask.set(row.id, place)
    }
    for (const [itemId, taskId] of roadmapTaskOf) {
      const place = byTask.get(taskId)
      if (place) out.set(itemId, place)
    }
  } catch {
    // The roadmap's places could not be read; the tasks' own stand.
  }
  return out
}

/** One roadmap task's place, for its card window (PR 5). Null for a task with none, and for a read that failed. */
export async function loadRoadmapTaskPlace(taskId: string): Promise<TaskPlace | null> {
  try {
    const res = (await supabase.from('checklist_tech_tree_group_tasks').select(TASK_PLACE_SELECT as '*').eq('id', taskId).limit(1)) as unknown as PlaceRead
    if (res.error || !res.data) return null
    return taskPlaceFromRow(res.data[0] ?? null)
  } catch {
    return null
  }
}

/**
 * Sets, moves or clears a roadmap task's place. The card window saves each edit by itself, so this
 * is one write and its answer: null when it landed, the reason in words when it did not.
 */
export async function saveRoadmapTaskPlace(taskId: string, place: TaskPlaceDraft | null, userId: string | null): Promise<string | null> {
  try {
    const cols = taskPlaceColumns(place, userId, new Date().toISOString())
    const { error } = await supabase.from('checklist_tech_tree_group_tasks').update(cols as never).eq('id', taskId)
    return error ? formatErrorMessage(error, 'The place did not save.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The place did not save.')
  }
}

/**
 * The person doing a task adds its missing place from a reading their phone just took (PR 8). One
 * call to `add_task_place_from_the_spot`, which holds every rule: who may, how sure the phone must
 * be, and never over a place that is already there. Null when it landed, the reason in words when it
 * did not. The function is younger than the generated types, hence the cast.
 */
export async function addTaskPlaceFromTheSpot(instanceId: string, fix: { lat: number; lng: number; accuracyM: number | null }, name: string): Promise<string | null> {
  try {
    // Written as a plain `supabase.rpc('name' …)` on purpose: `check:calls-ahead` reads this form, and holds the deploy
    // until the migration that creates the function is pushed.
    const { error } = await supabase.rpc('add_task_place_from_the_spot' as never, {
      p_instance_id: instanceId,
      p_lat: fix.lat,
      p_lng: fix.lng,
      p_accuracy_m: fix.accuracyM == null ? null : Math.round(fix.accuracyM),
      p_name: name.trim() || null,
    } as never)
    return error ? formatErrorMessage(error, 'The place did not save.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The place did not save.')
  }
}
