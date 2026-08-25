/**
 * Pure helpers for the Checklist review queue (Phase 3 of the checklist-card
 * redesign): completed-but-unreviewed instances surfaced to their reviewer —
 * the item's creator or notify-on-complete target (devs see everything) — with
 * Dismiss (stamp reviewed) and Reopen-with-comment actions in the section
 * component.
 *
 * Aging: the queue only shows completions from the last REVIEW_QUEUE_DAYS days
 * — older ones age out silently rather than silting the inbox (approved
 * design; no cron involved).
 */

import type { ChecklistCardEvent } from './checklistCardEvents'

export const REVIEW_QUEUE_DAYS = 7

export function reviewQueueCutoffIso(now: Date = new Date()): string {
  return new Date(now.getTime() - REVIEW_QUEUE_DAYS * 86_400_000).toISOString()
}

export type ReviewQueueInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  completed_at: string | null
  completed_by_user_id: string | null
  reviewed_at: string | null
  checklist_items?: {
    title: string
    created_by_user_id?: string | null
    notify_on_complete_user_id?: string | null
    roadmap_group_task_id?: string | null
  } | null
}

export type ReviewQueueRow = {
  instanceId: string
  itemId: string
  title: string
  completedAt: string
  completedByUserId: string | null
  /** Cost-estimate key: roadmap task id for bridged tasks, else the item id. */
  costKey: string
  /** Latest comment on the card, if any — the "…with a note" preview. */
  latestNoteBody: string | null
  latestNoteAuthorId: string | null
}

/**
 * Filter + shape the queue. `instances` should already be completed-and-
 * unreviewed within the cutoff (the query enforces that); this applies the
 * reviewer scope — creator or notify-target, dev sees all — and drops the
 * reviewer's own completions (nobody self-reviews).
 */
export function buildReviewQueueRows(args: {
  instances: ReviewQueueInstance[]
  eventsByInstance: Map<string, ChecklistCardEvent[]>
  currentUserId: string | null
  isDev: boolean
}): ReviewQueueRow[] {
  const { instances, eventsByInstance, currentUserId, isDev } = args
  if (!currentUserId) return []
  const rows: ReviewQueueRow[] = []
  for (const inst of instances) {
    if (!inst.completed_at || inst.reviewed_at) continue
    if (inst.completed_by_user_id === currentUserId) continue
    const item = inst.checklist_items
    const isReviewer =
      isDev ||
      item?.created_by_user_id === currentUserId ||
      item?.notify_on_complete_user_id === currentUserId
    if (!isReviewer) continue
    const events = eventsByInstance.get(inst.id) ?? []
    let latest: ChecklistCardEvent | null = null
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]
      if (e && e.event_type === 'comment') {
        latest = e
        break
      }
    }
    rows.push({
      instanceId: inst.id,
      itemId: inst.checklist_item_id,
      title: item?.title ?? 'Untitled',
      completedAt: inst.completed_at,
      completedByUserId: inst.completed_by_user_id,
      costKey: item?.roadmap_group_task_id ?? inst.checklist_item_id,
      latestNoteBody: latest ? latest.body : null,
      latestNoteAuthorId: latest ? latest.actor_user_id : null,
    })
  }
  rows.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  return rows
}
