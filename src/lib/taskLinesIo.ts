/**
 * Task cards: the Done when… lines' io (punch list #273, PR 2, v2.6595). The reads and writes over `task_criteria`
 * (a line on a card's definition or on a roadmap task) and `task_criteria_checks` (a line's tick on one day row), and
 * the `criterion` line each tick writes on the thread. The rules are `taskCriteria.ts`; the screens take this io so
 * their tests run over a fake. A tick's percent is the database's: the recount trigger of migration 20261106230000
 * writes the day row's percent from its ticks, and the last tick on a card that does not ask for a photo closes it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { criteriaRows, criterionEventBody, diffLines, type TaskCriterion, type TaskCriterionCheck } from './taskCriteria'

// The tables are younger than the generated types; the types PR after the push removes this cast.
const db = supabase as unknown as SupabaseClient

export const CRITERIA_SELECT = 'id, checklist_item_id, roadmap_task_id, body, sort_index, retired_at'
export const CHECKS_SELECT = 'criterion_id, instance_id, checked_at, checked_by, photo_id'

const inList = (ids: string[]) => `(${ids.join(',')})`

/** The writer's id for `created_by`: the one given, else the session's. The policy refuses a line in another's name. */
async function writerId(given: string | null | undefined): Promise<string> {
  if (given) return given
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? ''
}

/** The lines and the ticks for the cards on a screen, in two reads. */
export async function loadTaskLines(a: { itemIds: string[]; taskIds: string[]; instanceIds: string[] }): Promise<{ criteria: TaskCriterion[]; checks: TaskCriterionCheck[]; error: string | null }> {
  const itemIds = Array.from(new Set(a.itemIds.filter(Boolean)))
  const taskIds = Array.from(new Set(a.taskIds.filter(Boolean)))
  const instanceIds = Array.from(new Set(a.instanceIds.filter(Boolean)))
  if (itemIds.length === 0 && taskIds.length === 0) return { criteria: [], checks: [], error: null }
  const ors: string[] = []
  if (itemIds.length) ors.push(`checklist_item_id.in.${inList(itemIds)}`)
  if (taskIds.length) ors.push(`roadmap_task_id.in.${inList(taskIds)}`)
  const critRes = await db.from('task_criteria').select(CRITERIA_SELECT).or(ors.join(',')).is('retired_at', null).order('sort_index')
  if (critRes.error) return { criteria: [], checks: [], error: formatErrorMessage(critRes.error, 'The lines did not load.') }
  const criteria = (critRes.data ?? []) as TaskCriterion[]
  if (criteria.length === 0 || instanceIds.length === 0) return { criteria, checks: [], error: null }
  const checkRes = await db.from('task_criteria_checks').select(CHECKS_SELECT).in('instance_id', instanceIds)
  if (checkRes.error) return { criteria, checks: [], error: formatErrorMessage(checkRes.error, 'The ticks did not load.') }
  return { criteria, checks: (checkRes.data ?? []) as TaskCriterionCheck[], error: null }
}

/** A card's live lines, in order, for the edit dialog. */
export async function loadItemLines(itemId: string): Promise<TaskCriterion[]> {
  const { data } = await db.from('task_criteria').select(CRITERIA_SELECT).eq('checklist_item_id', itemId).is('retired_at', null).order('sort_index')
  return (data ?? []) as TaskCriterion[]
}

/** A roadmap task's live lines, in order. */
export async function loadTaskLinesOfRoadmapTask(taskId: string): Promise<TaskCriterion[]> {
  const { data } = await db.from('task_criteria').select(CRITERIA_SELECT).eq('roadmap_task_id', taskId).is('retired_at', null).order('sort_index')
  return (data ?? []) as TaskCriterion[]
}

/** The lines typed on a new card. Answers the reason it failed, or null. */
export async function writeItemLines(itemId: string, lines: string[], createdBy: string | null | undefined): Promise<string | null> {
  if (lines.length === 0) return null
  const { error } = await db.from('task_criteria').insert(criteriaRows({ checklistItemId: itemId }, lines, await writerId(createdBy)))
  return error ? formatErrorMessage(error, 'The Done when… lines did not save.') : null
}

/** The lines typed on a new roadmap task. */
export async function writeTaskLines(taskId: string, lines: string[], createdBy: string | null | undefined): Promise<string | null> {
  if (lines.length === 0) return null
  const { error } = await db.from('task_criteria').insert(criteriaRows({ roadmapTaskId: taskId }, lines, await writerId(createdBy)))
  return error ? formatErrorMessage(error, 'The Done when… lines did not save.') : null
}

/**
 * An edit's lines: kept lines take their new place, new lines are added, lines gone are retired (a ticked line keeps
 * its words for the ticks that name it). Answers the first failure's reason, or null.
 */
export async function syncItemLines(itemId: string, existing: TaskCriterion[], next: string[], createdBy?: string | null): Promise<string | null> {
  const d = diffLines(existing, next)
  const by = d.add.length ? await writerId(createdBy) : ''
  for (const k of d.keep) {
    const { error } = await db.from('task_criteria').update({ sort_index: k.sort_index }).eq('id', k.id)
    if (error) return formatErrorMessage(error, 'A Done when… line did not move.')
  }
  if (d.add.length) {
    const { error } = await db.from('task_criteria').insert(d.add.map((r) => ({ checklist_item_id: itemId, roadmap_task_id: null, body: r.body, sort_index: r.sort_index, created_by: by })))
    if (error) return formatErrorMessage(error, 'A Done when… line did not save.')
  }
  if (d.retire.length) {
    const { error } = await db.from('task_criteria').update({ retired_at: new Date().toISOString() }).in('id', d.retire)
    if (error) return formatErrorMessage(error, 'A Done when… line did not come off.')
  }
  return null
}

export type TickLineInput = {
  instanceId: string
  criterionId: string
  /** The line's words, for the thread. */
  body: string
  authUserId: string
  ticked: boolean
}

/** A tick or an untick on one day row, and its line on the thread (best effort: the tick stands without it). */
export async function tickLine(a: TickLineInput): Promise<{ ok: boolean; error?: string }> {
  if (a.ticked) {
    const { error } = await db
      .from('task_criteria_checks')
      .upsert({ criterion_id: a.criterionId, instance_id: a.instanceId, checked_by: a.authUserId, checked_at: new Date().toISOString() }, { onConflict: 'criterion_id,instance_id' })
    if (error) return { ok: false, error: formatErrorMessage(error, 'The tick did not save.') }
  } else {
    const { error } = await db.from('task_criteria_checks').delete().eq('criterion_id', a.criterionId).eq('instance_id', a.instanceId)
    if (error) return { ok: false, error: formatErrorMessage(error, 'The untick did not save.') }
  }
  try {
    await db.from('checklist_instance_events').insert({ instance_id: a.instanceId, event_type: 'criterion', actor_user_id: a.authUserId, body: criterionEventBody(a.body, a.ticked) })
  } catch {
    // The thread's line is the record of who ticked what; the tick itself has already landed.
  }
  return { ok: true }
}
