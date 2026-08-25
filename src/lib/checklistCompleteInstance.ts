/**
 * Shared checklist-instance completion (v2.2039): one place for the two side
 * effects Today's checkbox has always performed — completes-notifications and
 * materializing the next `days_after_completion` occurrence — so the activity
 * panel's ✓ Complete button behaves identically on Manage, Review, and Today.
 * The v2.1842 trigger writes the `completed` event to the card spine.
 */

import { supabase } from './supabase'
import { ymdAddDays } from '../utils/dateUtils'

export async function completeChecklistInstance(args: {
  instanceId: string
  checklistItemId: string
  scheduledDate: string
  authUserId: string
}): Promise<{ ok: boolean; error?: string }> {
  const { instanceId, checklistItemId, scheduledDate, authUserId } = args
  const { data: updated, error } = await supabase
    .from('checklist_instances')
    .update({ completed_at: new Date().toISOString(), completed_by_user_id: authUserId })
    .eq('id', instanceId)
    .is('completed_at', null)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!updated?.length) return { ok: false, error: 'Could not complete this task (already complete, or no access).' }
  void sendCompletionNotifications(checklistItemId, instanceId, authUserId)
  void maybeCreateNextInstance(checklistItemId, scheduledDate)
  // Completions land in the sign-off queue — tell any mounted queue to refetch
  // (same cross-surface pattern as `checklist-item-saved`). Matters when the
  // queue shares the screen with the completer: the Review tab's fold above
  // Outstanding-by-person, the Dashboard's Teams Inbox card.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('checklist-instance-completed', { detail: instanceId }))
  }
  return { ok: true }
}

/** Best-effort: "<name> completed: <title>" to the task's watchers. */
async function sendCompletionNotifications(checklistItemId: string, instanceId: string, authUserId: string) {
  try {
    const [{ data: item }, { data: me }] = await Promise.all([
      supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
        .eq('id', checklistItemId)
        .single(),
      supabase.from('users').select('name').eq('id', authUserId).single(),
    ])
    if (!item) return
    const title = (item as { title: string }).title
    const name = ((me as { name: string | null } | null)?.name ?? '').trim() || 'Someone'
    const recipients: string[] = []
    const notifyUserId = (item as { notify_on_complete_user_id: string | null }).notify_on_complete_user_id
    if (notifyUserId) recipients.push(notifyUserId)
    const notifyCreator = (item as { notify_creator_on_complete: boolean }).notify_creator_on_complete
    const creatorId = (item as { created_by_user_id: string }).created_by_user_id
    if (notifyCreator && creatorId && !recipients.includes(creatorId)) recipients.push(creatorId)
    for (const uid of recipients) {
      if (uid === authUserId) continue
      try {
        await supabase.functions.invoke('send-checklist-notification', {
          body: {
            recipient_user_id: uid,
            push_title: 'Checklist completed',
            push_body: `${name} completed: ${title}`,
            push_url: '/checklist',
            tag: `checklist-${instanceId}`,
          },
        })
      } catch {
        // best-effort
      }
    }
  } catch {
    // best-effort
  }
}

/** Repeat-after-completion tasks get their next occurrence, assignees copied. */
async function maybeCreateNextInstance(checklistItemId: string, scheduledDate: string) {
  try {
    const [{ data: item }, { data: assignees }] = await Promise.all([
      supabase.from('checklist_items').select('repeat_type, repeat_days_after, repeat_end_date').eq('id', checklistItemId).single(),
      supabase.from('checklist_item_assignees').select('user_id').eq('checklist_item_id', checklistItemId),
    ])
    if (!item) return
    if ((item as { repeat_type: string }).repeat_type !== 'days_after_completion') return
    const daysAfter = (item as { repeat_days_after: number | null }).repeat_days_after
    if (!daysAfter) return
    const assigneeIds = (assignees ?? []).map((r: { user_id: string }) => r.user_id)
    if (assigneeIds.length === 0) return
    const endDate = (item as { repeat_end_date: string | null }).repeat_end_date
    const nextDateStr = ymdAddDays(scheduledDate, daysAfter)
    if (endDate && nextDateStr > endDate) return
    const existing = await supabase
      .from('checklist_instances')
      .select('id')
      .eq('checklist_item_id', checklistItemId)
      .eq('scheduled_date', nextDateStr)
      .single()
    if (existing.data) return
    const { data: newInst } = await supabase
      .from('checklist_instances')
      .insert({ checklist_item_id: checklistItemId, scheduled_date: nextDateStr })
      .select('id')
      .single()
    if (newInst?.id) {
      for (const uid of assigneeIds) {
        await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: uid })
      }
    }
  } catch {
    // best-effort
  }
}
