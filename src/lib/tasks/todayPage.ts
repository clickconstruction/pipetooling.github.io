/**
 * Checklist → Today, redrawn in the New task window's language (punch list #369, step A1). The page used to say
 * *Checklist* twice and *Today* twice and never what to do first. This is the part with no screen in it: the head's
 * date and its one sentence, which task is Next, and the quiet line a done task wears.
 *
 * Every sentence here is read at the top of a phone in the field, so each is held to `plainWords.ts` by the test.
 */
import { dayLabel, daysBetween } from '../checklistDueDates'

/** The page's head: *Monday, Nov 16*. */
export function todayHeadDate(now: Date): string {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export type TodayCounts = {
  /** Tasks dated today, done or not. */
  today: number
  /** How many of those are done. */
  done: number
  /** Older tasks still open, the list under today's. */
  stillOpen: number
}

/**
 * Where the person stands, in the seat New task's bar gives to what Send will do: *1 of 3 done today. 8 older tasks
 * are still open.* A day with nothing dated says so, and an empty list of older tasks adds nothing.
 */
export function todaySentence(c: TodayCounts): string {
  const parts: string[] = []
  if (c.today <= 0) parts.push('Nothing is due today.')
  else if (c.done >= c.today) parts.push(c.today === 1 ? 'Your 1 task for today is done.' : `All ${c.today} tasks for today are done.`)
  else parts.push(`${c.done} of ${c.today} done today.`)
  if (c.stillOpen === 1) parts.push('1 older task is still open.')
  else if (c.stillOpen > 1) parts.push(`${c.stillOpen} older tasks are still open.`)
  return parts.join(' ')
}

/** Today's tasks in the order the list holds them, split by whether they are done. */
export function splitToday<T extends { completed_at: string | null }>(today: readonly T[]): { open: T[]; done: T[] } {
  const open: T[] = []
  const done: T[] = []
  for (const row of today) (row.completed_at ? done : open).push(row)
  return { open, done }
}

/**
 * Which task is Next: the first open task dated today, in the order the office set. With none left, a task that was
 * sent back comes before the rest of the older ones, since someone is waiting on it, and then the oldest.
 * `olderOpen` arrives oldest first, as the list under today's draws it.
 */
export function nextTaskId(todayOpen: readonly { id: string }[], olderOpen: readonly { id: string }[], sentBackIds: ReadonlySet<string> = new Set()): string | null {
  const first = todayOpen[0]
  if (first) return first.id
  const sentBack = olderOpen.find((r) => sentBackIds.has(r.id))
  return (sentBack ?? olderOpen[0])?.id ?? null
}

/**
 * The line under a done task, in place of a solid *Waiting on review* chip on every one: when it was done, and who
 * hears. A task nobody is told about says only when.
 */
export function doneLineWords(stamp: string, hearsName: string | null): string {
  const name = (hearsName ?? '').trim()
  return name ? `Done ${stamp}. ${name} hears it is done.` : `Done ${stamp}.`
}

/**
 * Who hears when a task is done: the person named on the task, else its giver when the giver asked to hear. Never the
 * person doing it, who needs no telling.
 */
export function taskHearsId(item: { notify_on_complete_user_id?: string | null; notify_creator_on_complete?: boolean | null; created_by_user_id?: string | null } | null | undefined, doerId: string | null): string | null {
  if (!item) return null
  const id = item.notify_on_complete_user_id || (item.notify_creator_on_complete ? item.created_by_user_id : null) || null
  return id && id !== doerId ? id : null
}

/** The small-caps labels over the parts of the day, with their counts. */
export function todayPartLabel(part: 'next' | 'then' | 'done', count: number): string {
  if (part === 'next') return 'Next'
  return part === 'then' ? `Then · ${count}` : `Done today · ${count}`
}

/** The words on the note press: *＋ Note* until a note exists, then how many. */
export function notePressLabel(notes: number): string {
  if (notes <= 0) return '＋ Note'
  return notes === 1 ? '1 note' : `${notes} notes`
}

/** How a still-open task's age is drawn: red for a due day that has passed, amber for an old task, grey for a young one. */
export type StillOpenTone = 'late' | 'old' | 'soft'

export type StillOpenAge = {
  /** The quiet words on the row: *given Thu, Aug 20*, *due Fri, Nov 6*, *due today*. */
  words: string
  /** The pill at the row's end: *88 days*, *10 days late*. None for a task given today or due later. */
  pill: string | null
  tone: StillOpenTone
}

/** A task with no due day turns amber once it has waited this many days. Before that its age is grey. */
export const STILL_OPEN_OLD_DAYS = 7

/**
 * A still-open task's age (punch list #369, step A2). The list used to print *due Thu, Aug 20 · 88 days ago* in red on
 * every row, and the day was only the day the task was given: none of the tasks it stood on had a due day. So a task
 * with no due day now says *given* and shows its age in amber, and red is kept for a real due day that has passed.
 */
export function stillOpenAge(scheduledDate: string, dueDate: string | null | undefined, todayStr: string): StillOpenAge {
  if (dueDate) {
    const late = daysBetween(dueDate, todayStr)
    if (late != null && late > 0) return { words: `due ${dayLabel(dueDate)}`, pill: late === 1 ? '1 day late' : `${late} days late`, tone: 'late' }
    if (late === 0) return { words: 'due today', pill: null, tone: 'old' }
    return { words: `due ${dayLabel(dueDate)}`, pill: null, tone: 'soft' }
  }
  const days = daysBetween(scheduledDate, todayStr)
  const words = `given ${dayLabel(scheduledDate)}`
  if (days == null || days <= 0) return { words, pill: null, tone: 'soft' }
  return { words, pill: days === 1 ? '1 day' : `${days} days`, tone: days >= STILL_OPEN_OLD_DAYS ? 'old' : 'soft' }
}

/** True when the task has a due day and it has passed: the one case the list and the map draw in red. */
export function stillOpenIsLate(dueDate: string | null | undefined, todayStr: string): boolean {
  if (!dueDate) return false
  const late = daysBetween(dueDate, todayStr)
  return late != null && late > 0
}

/**
 * The list's order: a task whose due day has passed comes first, then the rest as they arrived, oldest first. Without
 * this a late task with a recent due day sorts under the old ones and can sit behind the fold, the one red row hidden.
 */
export function lateFirst<T extends { checklist_items?: { due_date?: string | null } | null }>(rows: readonly T[], todayStr: string): T[] {
  const late = rows.filter((r) => stillOpenIsLate(r.checklist_items?.due_date ?? null, todayStr))
  if (late.length === 0) return [...rows]
  return [...late, ...rows.filter((r) => !stillOpenIsLate(r.checklist_items?.due_date ?? null, todayStr))]
}

/** The quiet words beside the list's label, which say its order. */
export function stillOpenOrderWords(anyLate: boolean): string {
  return anyLate ? 'late first, then oldest' : 'oldest first'
}

/** The list shows this many rows before it folds the rest behind one press. */
export const STILL_OPEN_FOLD = 3

/**
 * The rows the Still open list draws, and how many wait behind *Show N more*. A list one row past the fold is drawn
 * whole, since a press that reveals one row costs more than the row. A row opened from the map is never left folded.
 */
export function stillOpenShown<T extends { id: string }>(rows: readonly T[], showAll: boolean, pinnedId: string | null = null): { shown: T[]; hidden: number } {
  const pinnedBelow = pinnedId != null && rows.findIndex((r) => r.id === pinnedId) >= STILL_OPEN_FOLD
  if (showAll || pinnedBelow || rows.length <= STILL_OPEN_FOLD + 1) return { shown: [...rows], hidden: 0 }
  return { shown: rows.slice(0, STILL_OPEN_FOLD), hidden: rows.length - STILL_OPEN_FOLD }
}

export function stillOpenLabel(count: number): string {
  return `Still open · ${count}`
}

export function showMoreLabel(hidden: number): string {
  return `Show ${hidden} more`
}
