/**
 * Checklist → Today, redrawn in the New task window's language (punch list #369, step A1). The page used to say
 * *Checklist* twice and *Today* twice and never what to do first. This is the part with no screen in it: the head's
 * date and its one sentence, which task is Next, and the quiet line a done task wears.
 *
 * Every sentence here is read at the top of a phone in the field, so each is held to `plainWords.ts` by the test.
 */

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
