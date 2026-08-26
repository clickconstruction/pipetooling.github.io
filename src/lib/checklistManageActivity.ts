/**
 * Pure helpers for the Manage tab's expandable card activity panel: merge a
 * checklist item's instances + their `checklist_instance_events` rows (the
 * v2.1842 card spine) into one chronological timeline, and pick which
 * instance a newly-posted note should attach to (events live on instances,
 * not on the item template).
 */

import type { ChecklistCardEvent } from './checklistCardEvents'
import { dueChangeEntryText, type DueChangeRow } from './checklistDuePushes'

export type ManageInstanceLite = {
  id: string
  scheduled_date: string
  completed_at: string | null
}

export type ManageTimelineEntry =
  | { kind: 'created'; at: string; actorUserId: string | null }
  | { kind: 'due_change'; id: string; at: string; actorUserId: string | null; text: string }
  | {
      kind: 'event'
      id: string
      eventType: string
      at: string
      actorUserId: string | null
      body: string
      /** The owning instance's scheduled day — context for repeating items. */
      scheduledDate: string | null
    }

/**
 * One flat oldest-first timeline: the item's creation stamp, then every
 * instance event in time order. Events keep their instance's scheduled day so
 * the UI can say which occurrence a "completed" belonged to.
 */
export function buildManageTimeline(
  item: { created_at: string | null; created_by_user_id: string | null },
  instances: ManageInstanceLite[],
  events: ChecklistCardEvent[],
  /** Due-change ledger rows (v2.2371) — render as "pushed the due date …" lines. */
  dueChanges: DueChangeRow[] = [],
): ManageTimelineEntry[] {
  const dayByInstance = new Map<string, string>()
  for (const inst of instances) dayByInstance.set(inst.id, inst.scheduled_date)
  const entries: ManageTimelineEntry[] = []
  if (item.created_at) {
    entries.push({ kind: 'created', at: item.created_at, actorUserId: item.created_by_user_id })
  }
  dueChanges.forEach((d, i) => {
    entries.push({ kind: 'due_change', id: `due-${i}-${d.changed_at}`, at: d.changed_at, actorUserId: d.changed_by, text: dueChangeEntryText(d) })
  })
  for (const e of events) {
    entries.push({
      kind: 'event',
      id: e.id,
      eventType: e.event_type,
      at: e.created_at,
      actorUserId: e.actor_user_id,
      body: e.body,
      scheduledDate: dayByInstance.get(e.instance_id) ?? null,
    })
  }
  // ISO timestamps sort lexicographically; `created` wins ties so the card's
  // birth always renders first.
  return entries.sort((a, b) => {
    const cmp = a.at.localeCompare(b.at)
    if (cmp !== 0) return cmp
    if (a.kind === 'created') return -1
    if (b.kind === 'created') return 1
    return 0
  })
}

/**
 * Where a new note lands: the "current occurrence" — the latest instance
 * scheduled today or earlier (repeating tasks pre-materialize instances years
 * ahead, so plain "latest" would land on a far-future row), else the earliest
 * future instance (a task scheduled ahead with no occurrences yet), else null
 * (no instances — the composer should hide).
 */
export function commentTargetInstance(
  instances: ManageInstanceLite[],
  todayStr: string,
): ManageInstanceLite | null {
  let latestPast: ManageInstanceLite | null = null
  let earliestFuture: ManageInstanceLite | null = null
  for (const inst of instances) {
    if (inst.scheduled_date <= todayStr) {
      if (!latestPast || inst.scheduled_date > latestPast.scheduled_date) latestPast = inst
    } else if (!earliestFuture || inst.scheduled_date < earliestFuture.scheduled_date) {
      earliestFuture = inst
    }
  }
  return latestPast ?? earliestFuture
}
