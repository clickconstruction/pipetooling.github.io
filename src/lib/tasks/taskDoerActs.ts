/**
 * What the person doing a task may do with it, without waiting on someone (punch list #369, steps C2 to C7). The words
 * of each act and the small rules the screen holds before it asks the database, which holds them all again
 * (`20261117120000_task_doer_acts.sql`). Pure: the calls are in `taskDoerActsIo.ts`.
 */

import { DO_FIRST_LABEL, DO_FIRST_OFF_LABEL, DO_FIRST_OFF_WORDS, DO_FIRST_WORDS } from './doFirst'
import { DROP_TITLE } from './taskDrop'

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
  /** The person has said something is in the way (step C6). More then offers to take the mark off. */
  stuck?: boolean
  /** The person picked this task to do first on this device (step D1). */
  first?: boolean
  /** This task is Next already, by the list's own order: lifting it would change nothing. */
  next?: boolean
}

/** The acts behind the card's More. It grows a row with each tool. */
export type TaskMoreKey = 'first' | 'unfirst' | 'move' | 'stuck' | 'unstuck' | 'drop' | 'hand'

export const TASK_MORE_LABEL = '⋯ More'
export const TASK_MORE_TITLE = 'More for this task'

/**
 * The rows of More for one task. Only what the database would allow is offered, so a press never ends in a refusal the
 * screen could have seen coming. An empty list draws no More at all.
 */
export function taskMoreChoices(t: Pick<TaskDoerTarget, 'once' | 'done'> & Partial<Pick<TaskDoerTarget, 'roadmap' | 'vehicle' | 'stuck' | 'first' | 'next'>>): TaskChoice<TaskMoreKey>[] {
  const rows: TaskChoice<TaskMoreKey>[] = []
  // Do first leads, since it is the one row that changes nothing but the person's own order. A stuck task is never Next.
  if (!t.done && !t.stuck) {
    if (t.first) rows.push({ key: 'unfirst', label: DO_FIRST_OFF_LABEL, words: DO_FIRST_OFF_WORDS })
    else if (!t.next) rows.push({ key: 'first', label: DO_FIRST_LABEL, words: DO_FIRST_WORDS })
  }
  if (t.once && !t.done) rows.push({ key: 'move', label: 'Not today', words: 'Move it to a day you can do it.' })
  // Any open task can be stuck, a repeating one and a roadmap one too: the line is a note that someone is told of.
  if (!t.done) rows.push(t.stuck ? { key: 'unstuck', label: UNSTUCK_LABEL, words: 'Take the stuck mark off.' } : { key: 'stuck', label: STUCK_TITLE, words: 'Say what is in the way. Whoever gave it is told.' })
  // A close is a completion, and a roadmap task's or a vehicle task's completion says work was done. So neither is offered.
  if (t.once && !t.done && !t.roadmap && !t.vehicle) rows.push({ key: 'drop', label: DROP_TITLE, words: 'Close it with a reason.' })
  // A roadmap task's people are the roadmap's, so it is handed on from the Roadmap.
  if (!t.done && !t.roadmap) rows.push({ key: 'hand', label: HAND_TITLE, words: 'Give it to the right person, notes and all.' })
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
    case 'skipped':
      return b ? `skipped it that day: ${b}` : 'skipped it that day'
    default:
      return null
  }
}

// --- No longer applies: the person closes a one-time task without doing it. The rule and the words live in taskDrop.ts ---

export * from './taskDrop'

// --- Can't do it: the person says what is in the way (a stuck line, written like a note) ---

export const STUCK_TITLE = "Can't do it"
export const STUCK_ASK = 'What is in the way?'
export const UNSTUCK_LABEL = 'No longer stuck'
/** The reasons one press writes. The person may type their own instead. */
export const STUCK_REASONS: readonly string[] = ['Waiting on a part', 'Need a hand', 'Not sure how', 'Not mine']
export const STUCK_REASON_MIN = 3
export const STUCK_REASON_MAX = 200

/** The words as the thread will keep them: one line, trimmed, cut at the limit. */
export function stuckReasonTidy(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, STUCK_REASON_MAX)
}

/** Why the press is dead, or null when it can go. */
export function stuckRule(reason: string): string | null {
  return stuckReasonTidy(reason).length < STUCK_REASON_MIN ? 'Say what is in the way.' : null
}

/** The press names who is told, or what it does on a task the person gave themself. */
export function stuckPressLabel(ready: boolean, giverName: string | null): string {
  if (!ready) return 'Say what is in the way first'
  const name = (giverName ?? '').trim()
  return name ? `Tell ${name}` : 'Mark it stuck'
}

export function stuckSentence(giverName: string | null): string {
  const name = (giverName ?? '').trim()
  return name ? `${name} is told now. The task stays yours.` : 'The task stays yours and shows as stuck.'
}

/** The amber words a stuck task wears: *Stuck: Waiting on a part*. */
export function stuckChipWords(reason: string): string {
  const why = reason.trim()
  return why ? `Stuck: ${why}` : 'Stuck'
}

export function stuckPush(who: string, title: string, reason: string): { title: string; body: string } {
  return { title: 'Someone is stuck on a task', body: `${who} is stuck on "${title}": ${stuckReasonTidy(reason)}` }
}

/** The push the stuck person gets when someone in the office says it is sorted. */
export function sortedPush(who: string, title: string): { title: string; body: string } {
  return { title: 'Your task is sorted', body: `${who} says "${title}" is sorted. You can carry on.` }
}

/** The office's press on a stuck task, and the label of its list on Review. */
export const SORTED_LABEL = 'Sorted'
export function stuckListLabel(count: number): string {
  return `Stuck · ${count}`
}
/** One stuck row's words on Review: *Theo: Waiting on a part*. */
export function stuckRowWords(who: string, reason: string): string {
  const why = reason.trim()
  return why ? `${who}: ${why}` : `${who} is stuck`
}

// --- Go through the old ones: one task at a time, each answered with a tool above ---

export const PASS_PRESS_LABEL = 'Go through them'
export const PASS_TITLE = 'Go through the old ones'
/** The list offers the pass once it holds this many tasks. One old task needs no pass. */
export const PASS_MIN_TASKS = 2

export type PassAnswer = 'done' | 'move' | 'stuck' | 'drop' | 'skip'

/** Where the pass stands: *2 of 8*. */
export function passCountWords(index: number, total: number): string {
  return `${Math.min(index + 1, total)} of ${total}`
}

/**
 * The answers for one task of the pass. Each is a tool that exists, so the pass adds no rule of its own: what a task
 * cannot do under More it cannot do here. Skip is always last, and leaves the task as it is.
 */
export function passAnswers(t: Pick<TaskDoerTarget, 'once' | 'done'> & Partial<Pick<TaskDoerTarget, 'roadmap' | 'vehicle' | 'stuck'>>): TaskChoice<PassAnswer>[] {
  const more = taskMoreChoices(t).map((r) => r.key)
  const rows: TaskChoice<PassAnswer>[] = [{ key: 'done', label: 'Done', words: 'It is finished. Mark it done.' }]
  if (more.includes('move')) rows.push({ key: 'move', label: 'Still on it', words: 'Pick the day you will do it.' })
  if (more.includes('stuck')) rows.push({ key: 'stuck', label: STUCK_TITLE, words: 'Say what is in the way.' })
  if (more.includes('drop')) rows.push({ key: 'drop', label: DROP_TITLE, words: 'Close it with a reason.' })
  rows.push({ key: 'skip', label: 'Skip', words: 'Leave it as it is.' })
  return rows
}

/** What the pass came to, said when its last task is answered or the person stops. */
export function passSummary(sorted: number, total: number): string {
  const left = Math.max(0, total - sorted)
  if (sorted <= 0) return total === 1 ? 'Nothing changed. 1 task is as it was.' : `Nothing changed. ${total} tasks are as they were.`
  if (left === 0) return sorted === 1 ? 'You sorted the 1 task.' : `You sorted all ${sorted} tasks.`
  return `You sorted ${sorted}. ${left === 1 ? '1 is as it was.' : `${left} are as they were.`}`
}

// --- Hand it on: one person for another on the same task (task_hand_on) ---

export const HAND_TITLE = 'Hand it on'
export const HAND_ASK = 'Who takes it?'
export const HAND_REASON_MAX = 200
/** How many names the sheet lists under its search box before the person types. */
export const HAND_LIST_MAX = 6

export type HandPerson = { id: string; name: string }

/** The people who can take the task: everyone who can sign in but the one handing it on, by name, narrowed by what is typed. */
export function handPeople(people: ReadonlyArray<HandPerson>, selfId: string | null, query: string): HandPerson[] {
  const q = query.trim().toLowerCase()
  return people
    .filter((p) => p.id !== selfId && p.name.trim() !== '')
    .filter((p) => q === '' || p.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The pill that gives a task back to whoever gave it. */
export function handBackLabel(giverName: string): string {
  return `Back to ${giverName}`
}

export function handPressLabel(takerName: string | null): string {
  const name = (takerName ?? '').trim()
  return name ? `Hand it to ${name}` : 'Pick who takes it first'
}

/**
 * What the press will do. A one-time task moves whole, with its notes and its place. A task that repeats gives away
 * this day alone. The giver is named when they are neither the taker nor the person handing it on.
 */
export function handSentence(a: { takerName: string; once: boolean; toldName: string | null }): string {
  const first = a.once ? `${a.takerName} gets it with its notes and its place.` : `${a.takerName} gets it for this day. The task that repeats stays yours.`
  const told = (a.toldName ?? '').trim()
  return told ? `${first} ${told} is told.` : first
}

export function handPushToTaker(who: string, title: string, reason: string): { title: string; body: string } {
  const why = reason.trim()
  return { title: 'A task was handed to you', body: why ? `${who} handed you "${title}": ${why}` : `${who} handed you "${title}".` }
}

export function handPushToGiver(who: string, title: string, takerName: string): { title: string; body: string } {
  return { title: 'A task was handed on', body: `${who} handed "${title}" to ${takerName}.` }
}

// --- Forward: the office's window for the same act (handOnTask), on the Checklist and on My Inbox ---

export const FORWARD_TITLE = 'Forward task'
export const FORWARD_PICK_LABEL = 'Pick a person'
/** Under the task's words in the Forward window (punch list #369, step C7): the task itself goes, not a copy, and since v2.7563 the taker is told (`tellForwardTaker`). */
export const FORWARD_KEEPS_WORDS = 'The task goes as it is, with its notes, place and photos. Whoever takes it gets a message.'

/** Who the Forward window offers for the viewer's own task: everyone it was handed but the viewer, by name. */
export function forwardTakers(people: ReadonlyArray<HandPerson>, selfId: string | null): HandPerson[] {
  return handPeople(people, selfId, '')
}

/** The Forward window's press names who takes the task once someone is picked. */
export function forwardPressLabel(takerName: string | null, saving: boolean): string {
  if (saving) return 'Forwarding…'
  const name = (takerName ?? '').trim()
  return name ? `Forward to ${name}` : 'Forward'
}
