/**
 * Applies an edit's occurrence regeneration (v2.2057, scheduling overhaul
 * phase 3). Before this, the Edit modal changed the template and left every
 * occurrence on the old schedule with the old people. Decisions come from the
 * pure `planEditRegeneration` kernel; this file is just the IO:
 *
 *  - move a one-off's open occurrence to the new date (notes ride along)
 *  - delete future clean occurrences that no longer fit the config
 *  - create the occurrences the new config wants (upsert — idempotent)
 *  - re-point every INCOMPLETE occurrence's assignees at the current roster
 *    (completed occurrences keep their historical assignees)
 */

import { supabase } from './supabase'
import { planEditRegeneration, type MaterializeConfig } from './checklistMaterialize'

export async function applyEditRegeneration(
  itemId: string,
  cfg: MaterializeConfig,
  assigneeIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const todayStr = new Date().toLocaleDateString('en-CA')
  const { data: instData, error: instErr } = await supabase
    .from('checklist_instances')
    .select('id, scheduled_date, completed_at')
    .eq('checklist_item_id', itemId)
  if (instErr) return { ok: false, error: instErr.message }
  const instances = (instData ?? []) as Array<{ id: string; scheduled_date: string; completed_at: string | null }>

  const eventIds = new Set<string>()
  const ids = instances.map((i) => i.id)
  for (let i = 0; i < ids.length; i += 150) {
    const { data: evRows } = await supabase
      .from('checklist_instance_events')
      .select('instance_id')
      .in('instance_id', ids.slice(i, i + 150))
    for (const r of (evRows ?? []) as Array<{ instance_id: string }>) eventIds.add(r.instance_id)
  }

  const plan = planEditRegeneration(
    cfg,
    instances.map((i) => ({ ...i, hasEvents: eventIds.has(i.id) })),
    todayStr,
  )

  if (plan.moveInstanceId && plan.moveTo) {
    const { error } = await supabase
      .from('checklist_instances')
      .update({ scheduled_date: plan.moveTo })
      .eq('id', plan.moveInstanceId)
    if (error) return { ok: false, error: error.message }
  }
  if (plan.deleteIds.length > 0) {
    const { error } = await supabase.from('checklist_instances').delete().in('id', plan.deleteIds)
    if (error) return { ok: false, error: error.message }
  }
  for (const scheduledDate of plan.createDates) {
    const { data: inst, error } = await supabase
      .from('checklist_instances')
      .upsert(
        { checklist_item_id: itemId, scheduled_date: scheduledDate },
        { onConflict: 'checklist_item_id,scheduled_date' },
      )
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    if (inst?.id && assigneeIds.length > 0) {
      await supabase
        .from('checklist_instance_assignees')
        .insert(assigneeIds.map((uid) => ({ checklist_instance_id: inst.id, user_id: uid })))
    }
  }

  // Roster sync: every incomplete occurrence belongs to the CURRENT assignees
  // (this is what puts a reassigned task on the right person's Today list).
  const openIds = instances
    .filter((i) => i.completed_at == null && !plan.deleteIds.includes(i.id))
    .map((i) => i.id)
  if (openIds.length > 0) {
    const { error: delErr } = await supabase
      .from('checklist_instance_assignees')
      .delete()
      .in('checklist_instance_id', openIds)
    if (delErr) return { ok: false, error: delErr.message }
    if (assigneeIds.length > 0) {
      const rows = openIds.flatMap((iid) => assigneeIds.map((uid) => ({ checklist_instance_id: iid, user_id: uid })))
      const { error: insErr } = await supabase.from('checklist_instance_assignees').insert(rows)
      if (insErr) return { ok: false, error: insErr.message }
    }
  }
  return { ok: true }
}
