/**
 * What the person doing a task may do with it, without waiting on someone (punch list #369, steps C2 to C7). The words
 * of each act and the small rules the screen holds before it asks the database, which holds them all again
 * (`20261117120000_task_doer_acts.sql`). Pure: the calls are in `taskDoerActsIo.ts`.
 */

/** One row of a choice sheet: what it is called and one line on what it does. */
export type TaskChoice<K extends string = string> = { key: K; label: string; words: string }

/** How a new map for a task starts: a line drawn by hand, a line walked or driven, or one point. */
export type TaskMapStart = 'line' | 'walk' | 'place'

export const TASK_MAP_SHEET_TITLE = 'A map for this task'
export const TASK_MAP_SHEET_FOOT = 'The map goes on the task when you save it. Whoever gave the task can open it.'
/** Said when no painting window is there to open, such as on a page outside the app's frame. */
export const TASK_MAP_NOT_OPENED = 'The map window could not open here.'

/**
 * The ways to start a map from a task. Walking needs a phone that can say where it is, so that row is left out on a
 * device that cannot.
 */
export function taskMapStarts(canWalk: boolean): TaskChoice<TaskMapStart>[] {
  const rows: TaskChoice<TaskMapStart>[] = [{ key: 'line', label: 'Draw it by hand', words: 'Trace the line with a finger.' }]
  if (canWalk) rows.push({ key: 'walk', label: 'Walk or drive it', words: 'The phone paints the line as you go.' })
  rows.push({ key: 'place', label: 'Leave a point', words: 'Tap the spot. Add a name, words and a photo.' })
  return rows
}

/** What the tools need to know about the task they act on. The page builds one from a day row. */
export type TaskDoerTarget = {
  instanceId: string
  /** The task's words, without their link marks. */
  title: string
  /** A one-time task. A task that repeats is neither moved nor closed by the person doing it. */
  once: boolean
  /** A roadmap task: its lead takes it off and hands it on from the Roadmap. */
  roadmap: boolean
  /** A vehicle task: the office closes it. */
  vehicle: boolean
  done: boolean
  /** Who gave the task, told of what the person does with it. Null when the person gave it to themself. */
  giverId: string | null
  giverName: string | null
}

/** The acts behind the card's More. It grows a row with each tool. */
export type TaskMoreKey = 'move'

export const TASK_MORE_LABEL = '⋯ More'
export const TASK_MORE_TITLE = 'More for this task'

/**
 * The rows of More for one task. Only what the database would allow is offered, so a press never ends in a refusal the
 * screen could have seen coming. An empty list draws no More at all.
 */
export function taskMoreChoices(t: Pick<TaskDoerTarget, 'once' | 'done'>): TaskChoice<TaskMoreKey>[] {
  const rows: TaskChoice<TaskMoreKey>[] = []
  if (t.once && !t.done) rows.push({ key: 'move', label: 'Not today', words: 'Move it to a day you can do it.' })
  return rows
}

// --- Not today: the person moves a one-time task's due day (task_move_day) ---

/** A calendar day `n` days from another, both as YYYY-MM-DD. Noon, so a clock change never lands on the day before. */
export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (isNaN(d.getTime())) return ymd
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const MOVE_DAY_TITLE = 'Not today'
export const MOVE_DAY_PICK_LABEL = 'Pick a day'
/** The database's own limit: a day within a year. */
export const MOVE_DAY_MAX_DAYS = 366

export type MoveDayPick = { key: 'tomorrow' | 'monday'; label: string; ymd: string }

/**
 * The two days offered before the date box: tomorrow, and the Monday that starts the next week. When tomorrow is that
 * Monday, the second pick is the Monday after, so the two are never the same day.
 */
export function moveDayPicks(todayYmd: string): MoveDayPick[] {
  const tomorrow = addDaysYmd(todayYmd, 1)
  const dow = new Date(`${todayYmd}T12:00:00`).getDay()
  let toMonday = (8 - dow) % 7 || 7
  if (toMonday === 1) toMonday = 8
  return [
    { key: 'tomorrow', label: 'Tomorrow', ymd: tomorrow },
    { key: 'monday', label: 'Monday', ymd: addDaysYmd(todayYmd, toMonday) },
  ]
}

/** Why the day cannot be moved to yet, or null when it can. The words are the database's own. */
export function moveDayRule(ymd: string | null, todayYmd: string, dueYmd: string | null = null): string | null {
  if (!ymd) return 'Pick a day.'
  if (ymd < todayYmd) return 'Pick today or a later day.'
  if (ymd > addDaysYmd(todayYmd, MOVE_DAY_MAX_DAYS)) return 'Pick a day within a year.'
  if (dueYmd && ymd === dueYmd) return 'This task is already due that day.'
  return null
}

/** The words on the sheet's press, which say what it will do. `day` is the day as a card says it: *Fri, Nov 20*. */
export function moveDayPressLabel(day: string | null): string {
  return day ? `Move it to ${day}` : 'Pick a day first'
}

/** What the press will do, in the green line above it. */
export function moveDaySentence(day: string, giverName: string | null): string {
  const name = (giverName ?? '').trim()
  return name ? `It moves to ${day}. ${name} is told.` : `It moves to ${day}.`
}

/** How often a task has been moved, on its row: nothing, *moved once*, *moved twice*, *moved 3 times*. */
export function movedTimesWords(times: number): string {
  if (times <= 0) return ''
  if (times === 1) return 'moved once'
  return times === 2 ? 'moved twice' : `moved ${times} times`
}

/** The push the giver gets when a person moves their task. */
export function moveDayPush(who: string, title: string, day: string): { title: string; body: string } {
  return { title: 'A task was moved', body: `${who} moved "${title}" to ${day}.` }
}

// --- The thread: the lines the tools write, in words ---

/**
 * A line of the six kinds the doer's tools write, as a thread reads it after the person's name: *Theo moved it to
 * 2026-11-20* is no good, so the caller hands in the day already worded where the body is a day. Null for a kind this
 * does not know, which the thread then words as it always has.
 */
export function doerLineWords(eventType: string, body: string): string | null {
  const b = body.trim()
  switch (eventType) {
    case 'moved':
      return b ? `moved it to ${b}` : 'moved it to another day'
    case 'stuck':
      return b ? `is stuck: ${b}` : 'is stuck'
    case 'unstuck':
      return b ? `is no longer stuck: ${b}` : 'is no longer stuck'
    case 'dropped':
      return b ? `closed it as no longer applying: ${b}` : 'closed it as no longer applying'
    case 'handed':
      return b ? `handed it to ${b}` : 'handed it on'
    case 'map':
      return b ? `put a map on it: ${b}` : 'put a map on it'
    default:
      return null
  }
}
