/**
 * One person's day of tasks, with the person as a value (punch list #381). Checklist → Today read the signed-in
 * person inside the page, so nothing else could draw that day. This is the part with no read in it: the row a day is
 * made of, the order today's tasks take, and what Today does with each older task that is still open. The reads are in
 * `personDayIo.ts`.
 */
import { groupEventsByInstance, lastTransitionIsReopen, type ChecklistCardEvent } from '../checklistCardEvents'
import { qualifiesOutstanding, sortOutstanding } from '../checklistHistoryLedger'
import { lateFirst } from './todayPage'

/** The roadmap task a card was made from, as the day's read embeds it. */
export type RoadmapTaskEmbed = {
  group_id?: string
  /** Task cards (#273): the roadmap task's own switch; a card made from it reads it too. */
  asks_for_photo?: boolean | null
  checklist_tech_tree_groups?: {
    title?: string | null
    roadmap_id?: string
    checklist_tech_tree_roadmaps?: { title?: string | null } | null
  } | null
}

/** One task on one day, with the card it belongs to. */
export type PersonDayRow = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  completed_at: string | null
  /** Task cards (#273): the day row's percent; a done row reads 100 whatever is stored. */
  percent_complete?: number | null
  notes: string | null
  completed_by_user_id: string | null
  created_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  checklist_items?: {
    title: string
    links?: string[] | null
    notify_on_complete_user_id?: string | null
    notify_creator_on_complete?: boolean
    created_at?: string | null
    created_by_user_id?: string | null
    show_until_completed?: boolean | null
    due_date?: string | null
    repeat_type?: string | null
    roadmap_group_task_id?: string | null
    /** Task cards (#273): the writer's switch; the finish holds for a photo. */
    asks_for_photo?: boolean | null
    checklist_tech_tree_group_tasks?: RoadmapTaskEmbed | null
  } | null
}

/** A task with no place in the person's order goes after every task that has one. */
export const NO_ORDER = 999999

/**
 * Today's tasks in the order the office set for this person, then by date. The sort is stable, so two tasks with no
 * order keep the order they were read in, oldest written first.
 */
export function orderTodayRows<T extends { checklist_item_id: string; scheduled_date: string }>(rows: readonly T[], orderByItem: ReadonlyMap<string, number>): T[] {
  return [...rows].sort((a, b) => {
    const orderA = orderByItem.get(a.checklist_item_id) ?? NO_ORDER
    const orderB = orderByItem.get(b.checklist_item_id) ?? NO_ORDER
    if (orderA !== orderB) return orderA - orderB
    return a.scheduled_date.localeCompare(b.scheduled_date)
  })
}

type OlderRow = { id: string; scheduled_date: string; checklist_items?: { repeat_type?: string | null; show_until_completed?: boolean | null; due_date?: string | null } | null }

/**
 * The older open tasks whose threads decide what they are. A one-off or a show-until-done task is wanted whatever its
 * thread says. A repeating day is wanted only when someone sent it back, so its thread is read.
 */
export function olderRowsToRead<T extends OlderRow>(olderOpen: readonly T[]): string[] {
  return olderOpen.filter((r) => !qualifiesOutstanding(r.checklist_items)).map((r) => r.id)
}

export type OlderOpenParts<T> = {
  /** Still open: the one-offs, the show-until-done tasks and anything sent back, a late one first. */
  stillOpen: T[]
  /** Repeating days that went unticked and were not sent back. Yesterday's are asked about once. */
  missed: T[]
  /** The missed days the person already answered as skipped. */
  skippedIds: Set<string>
}

/**
 * What Today does with each older open task. `transitions` holds the completed, reopened and skipped lines of the rows
 * `olderRowsToRead` named, oldest first.
 */
export function olderOpenParts<T extends OlderRow>(olderOpen: readonly T[], transitions: readonly ChecklistCardEvent[], todayYmd: string): OlderOpenParts<T> {
  const wanted = olderOpen.filter((r) => qualifiesOutstanding(r.checklist_items))
  const rest = olderOpen.filter((r) => !qualifiesOutstanding(r.checklist_items))
  const grouped = groupEventsByInstance([...transitions])
  const sentBack = rest.filter((r) => lastTransitionIsReopen(grouped.get(r.id) ?? []))
  const sentBackIds = new Set(sentBack.map((r) => r.id))
  const skippedIds = new Set(rest.filter((r) => (grouped.get(r.id) ?? []).some((e) => e.event_type === 'skipped')).map((r) => r.id))
  return {
    // A task whose due day has passed leads the list, so the one red row is never behind the fold (punch list #369).
    stillOpen: lateFirst(sortOutstanding([...wanted, ...sentBack]), todayYmd),
    missed: rest.filter((r) => !sentBackIds.has(r.id)),
    skippedIds,
  }
}
