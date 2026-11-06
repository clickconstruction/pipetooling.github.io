/**
 * Task cards: the percent's io (punch list #273, PR 3). A percent set by hand on a card's day row, and the `progress`
 * line it writes on the thread with the what-is-left words. Done is not written here: the sheet's Done takes the
 * tick box's own path (`completeChecklistInstance` and the screens' toggles), so the notice, the Review queue and the
 * next repeat follow as they always did. The column is younger than the generated types, hence the cast.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { clampPercent, whatIsLeftWords } from './taskProgress'

const db = supabase as unknown as SupabaseClient

export type SetTaskPercentInput = {
  instanceId: string
  percent: number
  /** The what-is-left words, or empty. */
  words: string
  authUserId: string
}

/** Writes the percent on an open day row and its line on the thread (best effort: the percent stands without it). */
export async function setTaskPercent(a: SetTaskPercentInput): Promise<{ ok: boolean; error?: string }> {
  const percent = clampPercent(a.percent)
  const { data, error } = await db.from('checklist_instances').update({ percent_complete: percent }).eq('id', a.instanceId).is('completed_at', null).select('id')
  if (error) return { ok: false, error: formatErrorMessage(error, 'The percent did not save.') }
  if (!data || (Array.isArray(data) && data.length === 0)) return { ok: false, error: 'This card is already done, or not yours to move.' }
  try {
    await db.from('checklist_instance_events').insert({
      instance_id: a.instanceId,
      event_type: 'progress',
      actor_user_id: a.authUserId,
      percent,
      body: whatIsLeftWords(a.words),
    })
  } catch {
    // The thread's line is the record of who moved it; the percent itself has already landed.
  }
  return { ok: true }
}

/** The percent on a roadmap task that has no card yet (the office's Set the % on the task card, PR 3b). */
export async function setRoadmapTaskPercent(taskId: string, percent: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db.from('checklist_tech_tree_group_tasks').update({ percent_complete: clampPercent(percent) }).eq('id', taskId).is('completed_at', null)
  return error ? { ok: false, error: formatErrorMessage(error, 'The percent did not save.') } : { ok: true }
}
