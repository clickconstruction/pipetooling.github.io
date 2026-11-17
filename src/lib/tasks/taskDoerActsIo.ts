import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The calls behind the doer's tools (punch list #369). Each is one function of `20261117120000_task_doer_acts.sql`,
 * which holds every rule and refuses in words. Null when it landed, the reason when it did not. The functions are
 * younger than the generated types, hence the casts.
 *
 * Each call is written as a plain `supabase.rpc('name' …)` on purpose: `check:calls-ahead` reads this form, and holds
 * the deploy until the migration that creates the function is pushed.
 */

/** The person doing a task puts a map they painted on it. Only a task with no map takes one. */
export async function addTaskMap(instanceId: string, mapId: string): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('task_add_map' as never, { p_instance_id: instanceId, p_map_id: mapId } as never)
    return error ? formatErrorMessage(error, 'The map did not go on the task.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The map did not go on the task.')
  }
}
