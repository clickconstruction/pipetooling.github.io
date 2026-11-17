import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { getCurrentUserName } from '../getCurrentUserName'
import { handPushToTaker } from './taskDoerActs'

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

/** The person doing a one-time task moves its due day. `ymd` is YYYY-MM-DD. */
export async function moveTaskDay(instanceId: string, ymd: string): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('task_move_day' as never, { p_instance_id: instanceId, p_day: ymd } as never)
    return error ? formatErrorMessage(error, 'The task did not move.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The task did not move.')
  }
}

/** The person doing a one-time task closes it without doing it, with a reason. */
export async function dropTask(instanceId: string, reason: string): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('task_no_longer_applies' as never, { p_instance_id: instanceId, p_reason: reason } as never)
    return error ? formatErrorMessage(error, 'The task did not close.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The task did not close.')
  }
}

/**
 * Tell whoever gave a task what the person doing it just did: one push through the function the completion push uses,
 * so their hours and their devices are honoured the same way. Never throws and never holds the act: the act has
 * landed by the time this is called, and its line is in the thread either way.
 */
export async function tellTaskGiver(a: { giverId: string | null; instanceId: string; title: string; body: string }): Promise<void> {
  if (!a.giverId) return
  try {
    await supabase.functions.invoke('send-checklist-notification', {
      body: { recipient_user_id: a.giverId, push_title: a.title, push_body: a.body, push_url: '/checklist', tag: `checklist-${a.instanceId}` },
    })
  } catch {
    // the thread carries the line; a lost push is not the act's failure
  }
}

/**
 * A stuck line, the line that takes it off, or a skipped line (step D3), written like a note: whoever can read a task may write either, as
 * themself. No function stands between, since the line changes nothing but the thread.
 */
export async function sayTaskStuck(a: { instanceId: string; userId: string; kind: 'stuck' | 'unstuck' | 'skipped'; words: string }): Promise<string | null> {
  try {
    const { error } = await supabase.from('checklist_instance_events').insert({ instance_id: a.instanceId, event_type: a.kind, actor_user_id: a.userId, body: a.words } as never)
    return error ? formatErrorMessage(error, 'That did not save.') : null
  } catch (e) {
    return formatErrorMessage(e, 'That did not save.')
  }
}

/**
 * One person for another on the same task. The person doing it hands on their own; the office names whose with
 * `fromUserId`. The task keeps its thread, place, lines and photos.
 */
export async function handOnTask(instanceId: string, toUserId: string, reason: string | null = null, fromUserId: string | null = null): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('task_hand_on' as never, { p_instance_id: instanceId, p_to: toUserId, p_reason: reason, p_from: fromUserId } as never)
    return error ? formatErrorMessage(error, 'The task was not handed on.') : null
  } catch (e) {
    return formatErrorMessage(e, 'The task was not handed on.')
  }
}

/**
 * The office's Forward tells whoever takes the task (v2.7563, as Hand it on does): the same words, sent
 * the same way. Called once the hand-on has landed, so it never throws and never holds the window.
 */
export async function tellForwardTaker(
  a: { byUserId: string; toUserId: string; instanceId: string; taskTitle: string },
  deps: { tell?: typeof tellTaskGiver; nameOf?: (userId: string) => Promise<string> } = {},
): Promise<void> {
  const { tell = tellTaskGiver, nameOf = getCurrentUserName } = deps
  if (!a.toUserId || a.toUserId === a.byUserId) return
  const who = (await nameOf(a.byUserId).catch(() => '')).trim() || 'Someone'
  const push = handPushToTaker(who, a.taskTitle, '')
  await tell({ giverId: a.toUserId, instanceId: a.instanceId, title: push.title, body: push.body })
}
