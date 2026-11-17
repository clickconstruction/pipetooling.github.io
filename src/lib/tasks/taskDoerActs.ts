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
