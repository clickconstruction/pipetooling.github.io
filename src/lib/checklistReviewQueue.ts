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

/**
 * Server-side cap on the queue read. It is applied AFTER the reviewer scope
 * (v2.2917, J30-N1): the 50 newest rows are the viewer's 50 newest, not the
 * company's — a master whose cards sat past the 50 newest company-wide
 * completions used to see none of them, and TO SIGN OFF undercounted.
 */
export const REVIEW_QUEUE_LIMIT = 50

export type ReviewQueueScope = { currentUserId: string; isDev: boolean }

/**
 * Select list for the queue read. Non-devs embed `checklist_items!inner` so
 * the reviewer filter on the item (see `reviewQueueServerFilters`) drops the
 * parent instance row too; devs see every item and keep the left join, so an
 * instance whose item is unreadable still renders as "Untitled".
 */
export function reviewQueueSelect(isDev: boolean): string {
  const embed = isDev ? 'checklist_items' : 'checklist_items!inner'
  return `id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, reviewed_at, ${embed}(title, created_by_user_id, notify_on_complete_user_id, roadmap_group_task_id)`
}

/**
 * PostgREST `or` filter strings the section applies BEFORE `.limit()`.
 * `reviewerOr` targets the embedded `checklist_items` (pass it with
 * `{ referencedTable: 'checklist_items' }`); null for devs, who review all.
 * `completerOr` is top-level: nobody self-reviews, but a row with no recorded
 * completer still queues. User ids are UUIDs, so interpolating them is safe.
 */
export function reviewQueueServerFilters(scope: ReviewQueueScope): { reviewerOr: string | null; completerOr: string } {
  const id = scope.currentUserId
  return {
    reviewerOr: scope.isDev ? null : `created_by_user_id.eq.${id},notify_on_complete_user_id.eq.${id}`,
    completerOr: `completed_by_user_id.is.null,completed_by_user_id.neq.${id}`,
  }
}

/**
 * In-memory mirror of `reviewQueueSelect` + `reviewQueueServerFilters` — what
 * the server keeps. Tests pin it to `buildReviewQueueRows`' own scope so the
 * two can't drift.
 */
export function matchesReviewQueueScope(inst: ReviewQueueInstance, scope: ReviewQueueScope): boolean {
  if (inst.completed_by_user_id === scope.currentUserId) return false
  if (scope.isDev) return true
  const item = inst.checklist_items
  if (!item) return false
  return item.created_by_user_id === scope.currentUserId || item.notify_on_complete_user_id === scope.currentUserId
}

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
