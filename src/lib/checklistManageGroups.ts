/**
 * Pure helpers for the Manage tab's task library: repeat-rule chips, the
 * open-age signal for one-off tasks, and (since v2.7767) the library's parts
 * and the one pass over the tasks' days that feeds them.
 */
import { compareOldestFirst } from './ageState'

const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type ManageChipItem = {
  show_until_completed?: boolean | null
  repeat_type?: string | null
  repeat_days_of_week?: number[] | null
  repeat_days_after?: number | null
}

/** "until completed" / "Every day" / "Mon Wed Fri" / "7 days after done" / "once". */
export function repeatChipLabel(item: ManageChipItem): string {
  if (item.show_until_completed) return 'until completed'
  if (item.repeat_type === 'day_of_week') {
    const days = [...new Set(item.repeat_days_of_week ?? [])].filter((d) => d >= 0 && d <= 6).sort()
    if (days.length === 0) return 'weekly'
    if (days.length === 7) return 'Every day'
    return days.map((d) => DAY_ABBREV[d]).join(' ')
  }
  if (item.repeat_type === 'days_after_completion') {
    const n = item.repeat_days_after ?? 0
    return n === 1 ? '1 day after done' : `${n} days after done`
  }
  return 'once'
}

/**
 * "open 150 days" chip for one-offs; "starts Mon, Aug 31" when the task's
 * date hasn't arrived yet (v2.2346 — before this, every future date collapsed
 * into "open today" and scheduled work wore the overdue chip); '' when
 * nothing is open.
 */
export function openAgeLabel(oldestIncompleteDate: string | undefined, todayStr: string): string {
  if (!oldestIncompleteDate) return ''
  const t = new Date(todayStr + 'T00:00:00')
  const d = new Date(oldestIncompleteDate + 'T00:00:00')
  if (isNaN(t.getTime()) || isNaN(d.getTime())) return ''
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000)
  if (days < 0) {
    const future = new Date(oldestIncompleteDate + 'T12:00:00')
    return `starts ${future.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
  }
  if (days === 0) return 'open today'
  return `open ${days === 1 ? '1 day' : `${days} days`}`
}

/** True when the one-off's earliest open occurrence is still in the future — the Manage "Scheduled" section test (v2.2346). */
export function isScheduledAhead(oldestIncompleteDate: string | undefined, todayStr: string): boolean {
  return !!oldestIncompleteDate && oldestIncompleteDate > todayStr
}

/** "next Mon, Aug 24" chip for repeating rows; "next today" → "due today"; '' when nothing upcoming. */
export function nextOccurrenceLabel(nextOpenDate: string | undefined, todayStr: string): string {
  if (!nextOpenDate) return ''
  if (nextOpenDate === todayStr) return 'due today'
  const d = new Date(nextOpenDate + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  return `next ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
}

// ─── The library's parts (out of the Manage tab, v2.7767) ───────────────────

/** What the library's parts read of a task. */
export type ManageBucketItem = {
  id: string
  show_until_completed?: boolean | null
  repeat_type?: string | null
  created_at?: string | null
}

/** One task's days, counted: how many it has and whether any is still open. */
export type ManageItemCompletion = { total: number; hasIncomplete: boolean }

/** A day row as the library's scan reads it. */
export type ManageInstanceRow = { checklist_item_id: string; completed_at: string | null; scheduled_date: string }

/**
 * "Until completed" and "Once" are one-off tasks; the day_of_week and days_after_completion
 * types are repeating. (Mirrors the repeat chip.)
 */
export function isRepeatingItem(item: Pick<ManageBucketItem, 'show_until_completed' | 'repeat_type'>): boolean {
  return !item.show_until_completed && (item.repeat_type === 'day_of_week' || item.repeat_type === 'days_after_completion')
}

/** A one-off task is complete when it has at least one day and none is open. */
export function isItemCompleteFrom(completion: ManageItemCompletion | undefined): boolean {
  return !!completion && completion.total > 0 && !completion.hasIncomplete
}

/**
 * One pass over every day of the loaded tasks: per task, how many days and whether one is open,
 * its oldest open day (the "open N days" chip), and its next open day from today on (the "next …" chip).
 */
export function deriveItemInstanceStats(
  rows: readonly ManageInstanceRow[],
  todayYmd: string,
): { completion: Map<string, ManageItemCompletion>; oldestOpen: Map<string, string>; nextOpen: Map<string, string> } {
  const completion = new Map<string, ManageItemCompletion>()
  const oldestOpen = new Map<string, string>()
  const nextOpen = new Map<string, string>()
  for (const inst of rows) {
    const cur = completion.get(inst.checklist_item_id) ?? { total: 0, hasIncomplete: false }
    cur.total += 1
    if (!inst.completed_at) {
      cur.hasIncomplete = true
      const prev = oldestOpen.get(inst.checklist_item_id)
      if (!prev || inst.scheduled_date < prev) oldestOpen.set(inst.checklist_item_id, inst.scheduled_date)
      if (inst.scheduled_date >= todayYmd) {
        const prevNext = nextOpen.get(inst.checklist_item_id)
        if (!prevNext || inst.scheduled_date < prevNext) nextOpen.set(inst.checklist_item_id, inst.scheduled_date)
      }
    }
    completion.set(inst.checklist_item_id, cur)
  }
  return { completion, oldestOpen, nextOpen }
}

/** Newest made first; a task with no made date sorts as the oldest. */
function byCreatedDesc(a: Pick<ManageBucketItem, 'created_at'>, b: Pick<ManageBucketItem, 'created_at'>): number {
  return (b.created_at ? Date.parse(b.created_at) : 0) - (a.created_at ? Date.parse(a.created_at) : 0)
}

/**
 * The library's parts. Open one-offs come oldest open day first (a task with no day yet falls back to the day
 * it was made), and one whose first open day is still ahead waits in `scheduledOneOffs`, soonest first;
 * repeating and finished tasks come newest made first. `incompleteItems` is every one-off not finished, newest
 * made first: the One-offs pill counts it and the Timeline draws it.
 */
export function bucketManageItems<T extends ManageBucketItem>(
  items: readonly T[],
  completionByItem: ReadonlyMap<string, ManageItemCompletion>,
  oldestOpenByItem: ReadonlyMap<string, string>,
  todayYmd: string,
): { incompleteItems: T[]; openOneOffs: T[]; scheduledOneOffs: T[]; repeatingItems: T[]; completeItems: T[] } {
  const isComplete = (i: T) => isItemCompleteFrom(completionByItem.get(i.id))
  const incompleteItems = items.filter((i) => !isRepeatingItem(i) && !isComplete(i)).sort(byCreatedDesc)
  const openOneOffs = incompleteItems
    .filter((i) => !isScheduledAhead(oldestOpenByItem.get(i.id), todayYmd))
    .sort((a, b) =>
      compareOldestFirst(oldestOpenByItem.get(a.id) ?? a.created_at ?? undefined, oldestOpenByItem.get(b.id) ?? b.created_at ?? undefined),
    )
  const scheduledOneOffs = incompleteItems
    .filter((i) => isScheduledAhead(oldestOpenByItem.get(i.id), todayYmd))
    .sort((a, b) => (oldestOpenByItem.get(a.id) ?? '').localeCompare(oldestOpenByItem.get(b.id) ?? ''))
  const repeatingItems = items.filter((i) => isRepeatingItem(i)).sort(byCreatedDesc)
  const completeItems = items.filter((i) => !isRepeatingItem(i) && isComplete(i)).sort(byCreatedDesc)
  return { incompleteItems, openOneOffs, scheduledOneOffs, repeatingItems, completeItems }
}
