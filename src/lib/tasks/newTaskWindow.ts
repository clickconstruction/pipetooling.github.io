/**
 * The New task window's words and order (punch list #331, PR 1).
 *
 * The window that gives a task grew one field at a time and showed every one open. Of the 137
 * tasks made in it by 2026-11-12, 96 used none of its eight extras and 110 of the 129 one-time
 * tasks were for the day they were made. The redraw keeps every field and the same save, and puts
 * the common task on one screen: faces for the people, one bar for the day, a row of named presses
 * for the rare things, and a bar at the bottom that says in words what Send will do.
 *
 * This file is the part of that with no screen in it:
 *  - who is in the row of faces, and in what order (`recentAssigneeIds`, `taskFaces`);
 *  - the day bar's four choices over the stored `when` and start day (`whenBarChoice`, …);
 *  - the presses in the Add row, each with its value once set (`taskAddRow`);
 *  - the sentence in the bar and the label on Send (`newTaskSentence`, `taskSendLabel`).
 *
 * The sentence is read by a first-timer, so it keeps to `plainWords.ts`: one idea a sentence, none
 * over 20 words, no dash, semicolon or parenthesis. The test holds every shape of it to that.
 */

import { REMINDER_PRESETS, reminderTimeLabel } from '../checklistReminderOptions'
import { ymdAddDays } from '../../utils/dateUtils'

// ───────────────────────────────────────────────────────────── the faces ──

export interface TaskFace {
  id: string
  /** The name under the circle: *Me* for the giver, else the person's name or email. */
  name: string
  /** The letter in the circle. */
  mark: string
  me: boolean
}

/** How many of the people given to last are offered as faces. A phone shows the first four without a swipe. */
export const TASK_FACES_RECENT_LIMIT = 8

/**
 * The people a giver gave to last, newest first, each once, the giver left out.
 * `itemIdsNewestFirst` is the giver's own tasks in the order made; `rows` is who each went to.
 */
export function recentAssigneeIds(
  itemIdsNewestFirst: readonly string[],
  rows: ReadonlyArray<{ checklist_item_id: string; user_id: string }>,
  meId: string | null,
  limit: number = TASK_FACES_RECENT_LIMIT,
): string[] {
  const byItem = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.user_id) continue
    const list = byItem.get(row.checklist_item_id)
    if (list) list.push(row.user_id)
    else byItem.set(row.checklist_item_id, [row.user_id])
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const itemId of itemIdsNewestFirst) {
    // Within one task the people sort by id, so the order does not turn on how the rows came back.
    for (const userId of [...(byItem.get(itemId) ?? [])].sort()) {
      if (userId === meId || seen.has(userId)) continue
      seen.add(userId)
      out.push(userId)
      if (out.length >= limit) return out
    }
  }
  return out
}

/** The letter in a face's circle: the first letter or digit of the name, upper case. */
export function faceMark(name: string): string {
  const first = /[\p{L}\p{N}]/u.exec(name.trim())
  return first ? first[0]!.toUpperCase() : '?'
}

/** A person's name as the window shows it: the name, else the email, else an ellipsis. */
export function taskPersonName(person: { name?: string | null; email?: string | null } | undefined): string {
  return person?.name?.trim() || person?.email?.trim() || '…'
}

export interface TaskFacesInput {
  meId: string | null
  /** Everyone a task can go to. A face is drawn only for someone on it. */
  roster: ReadonlyArray<{ id: string; name?: string | null; email?: string | null }>
  /** From `recentAssigneeIds`. */
  recentIds: readonly string[]
  /**
   * People who must show though they are not recent: whoever the window opened on, and anyone
   * picked from the full list while it was open. They sit right after Me, in this order, so a
   * person picked from the list is never off the row's end.
   */
  extraIds: readonly string[]
}

/** The row of faces: Me, then the extras, then the people given to last. Each person once. */
export function taskFaces(input: TaskFacesInput): TaskFace[] {
  const byId = new Map(input.roster.map((p) => [p.id, p]))
  const out: TaskFace[] = []
  const seen = new Set<string>()
  const push = (id: string) => {
    const person = byId.get(id)
    if (!person || seen.has(id)) return
    seen.add(id)
    const me = id === input.meId
    const name = taskPersonName(person)
    out.push({ id, name: me ? 'Me' : name, mark: faceMark(name), me })
  }
  if (input.meId) push(input.meId)
  input.extraIds.forEach(push)
  input.recentIds.forEach(push)
  return out
}

/**
 * The rule the window has always had: when the task was only the giver's and the giver adds
 * someone else, the giver drops off, so the new default is the other person alone.
 */
export function dropSoloSelfWhenAddingOthers(prev: readonly string[], next: readonly string[], meId: string | null): string[] {
  if (!meId || prev.length !== 1 || prev[0] !== meId) return [...next]
  if (next.includes(meId) && next.some((id) => id !== meId)) return next.filter((id) => id !== meId)
  return [...next]
}

/** One press on a face: on goes off, off goes on, with the solo-self rule. */
export function toggleFace(assigneeIds: readonly string[], id: string, meId: string | null): string[] {
  if (assigneeIds.includes(id)) return assigneeIds.filter((x) => x !== id)
  return dropSoloSelfWhenAddingOthers(assigneeIds, [...assigneeIds, id], meId)
}

// ─────────────────────────────────────────────────────────── the day bar ──

export type WhenBarChoice = 'today' | 'tomorrow' | 'day' | 'repeat'

/** The stored shape the save already reads: the three-way `when` and the start day. */
export interface StoredWhen {
  when: 'today' | 'date' | 'repeat'
  startDate: string
}

/**
 * Which of the bar's four is lit. *Tomorrow* is a date like any other, stored as `date` with the
 * next day, so `asTomorrow` says whether the giver pressed Tomorrow or picked that day in the box.
 */
export function whenBarChoice(stored: StoredWhen, todayStr: string, asTomorrow: boolean): WhenBarChoice {
  if (stored.when === 'today') return 'today'
  if (stored.when === 'repeat') return 'repeat'
  return asTomorrow && stored.startDate === ymdAddDays(todayStr, 1) ? 'tomorrow' : 'day'
}

/** What a press on the bar stores. *Pick a day* keeps a day already picked; *Repeats* starts today unless a later day is set. */
export function whenBarPick(choice: WhenBarChoice, stored: StoredWhen, todayStr: string): StoredWhen {
  if (choice === 'today') return { when: 'today', startDate: todayStr }
  if (choice === 'tomorrow') return { when: 'date', startDate: ymdAddDays(todayStr, 1) }
  const startDate = stored.startDate && stored.startDate >= todayStr ? stored.startDate : todayStr
  return { when: choice === 'day' ? 'date' : 'repeat', startDate }
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function ymdParts(ymd: string): { dow: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(date.getTime())) return null
  return { dow: date.getUTCDay(), month: date.getUTCMonth(), day: date.getUTCDate() }
}

/** *Fri, Nov 20*: a day as the window's words name it. A day that does not parse echoes back. */
export function taskDayWords(ymd: string): string {
  const p = ymdParts(ymd)
  return p ? `${DAY_SHORT[p.dow]}, ${MONTH_SHORT[p.month]} ${p.day}` : ymd
}

/** The third segment's words: *Pick a day* until it is the lit one, then the day, *Mon 16*. */
export function whenBarDayLabel(choice: WhenBarChoice, startDate: string): string {
  if (choice !== 'day') return 'Pick a day'
  const p = ymdParts(startDate)
  return p ? `${DAY_SHORT[p.dow]} ${p.day}` : 'Pick a day'
}

// ─────────────────────────────────────────────────────────── the Add row ──

export type TaskAddKey = 'remind' | 'tellOther' | 'link' | 'due' | 'lines' | 'photo' | 'oneDay'

export interface TaskAddPress {
  key: TaskAddKey
  /** The words on the press: *+ Remind*, or once set *✓ Remind · Morning 7:00*. */
  label: string
  /** Set. A set press is lit. */
  on: boolean
  /** A press that flips in place. The others open their own panel under the row. */
  toggle: boolean
}

export interface TaskAddRowInput {
  when: 'today' | 'date' | 'repeat'
  /** `HH:MM`, or empty for no reminder. */
  reminderTime: string
  /** Who else hears when it is done, or null. */
  tellOtherName: string | null
  /** Links with something typed in them. */
  linkCount: number
  /** The due day, or empty. */
  dueDate: string
  /** Done when… lines written. */
  lineCount: number
  asksForPhoto: boolean
  /** The stored `show_until_completed`. Off is *Just for the day*. */
  staysUntilDone: boolean
}

/** *Morning 7:00* for a preset, *9:30 AM* for a time of the giver's own. */
export function reminderPressWords(time: string): string {
  return REMINDER_PRESETS.find((p) => p.time === time)?.label ?? reminderTimeLabel(time)
}

function press(key: TaskAddKey, on: boolean, name: string, setWords: string | null, toggle = false): TaskAddPress {
  return { key, on, toggle, label: on ? `✓ ${setWords ?? name}` : `+ ${name}` }
}

/**
 * The rare things, by name, in the order of their use. *Due by* and *Just for the day* belong to a
 * one-time task, so a repeating task leaves them out. A due day keeps a task until it is done, so
 * it takes *Just for the day* off the row.
 */
export function taskAddRow(input: TaskAddRowInput): TaskAddPress[] {
  const oneTime = input.when !== 'repeat'
  const row: TaskAddPress[] = [
    press('remind', Boolean(input.reminderTime), 'Remind', `Remind · ${reminderPressWords(input.reminderTime)}`),
    press('tellOther', Boolean(input.tellOtherName), 'Tell someone else', `Also tells ${input.tellOtherName}`),
    press('link', input.linkCount > 0, 'Link', `${input.linkCount} link${input.linkCount === 1 ? '' : 's'}`),
  ]
  if (oneTime) row.push(press('due', Boolean(input.dueDate), 'Due by', `Due by ${taskDayWords(input.dueDate)}`))
  row.push(press('lines', input.lineCount > 0, 'Done when…', `Done when… · ${input.lineCount} line${input.lineCount === 1 ? '' : 's'}`))
  row.push(press('photo', input.asksForPhoto, 'Photo at the finish', null, true))
  if (oneTime && !input.dueDate) row.push(press('oneDay', !input.staysUntilDone, 'Just for the day', null, true))
  return row
}

// ───────────────────────────────────────────────── the sentence and Send ──

function joinAnd(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** What the card will carry, as one sentence, or null: *It has 2 Done when… lines and asks for a photo at the finish.* */
function cardCarries(lineCount: number, asksForPhoto: boolean): string | null {
  const lines = lineCount > 0 ? `${lineCount} Done when… line${lineCount === 1 ? '' : 's'}` : null
  if (lines && asksForPhoto) return `It has ${lines} and asks for a photo at the finish.`
  if (lines) return `It has ${lines}.`
  return asksForPhoto ? 'It asks for a photo at the finish.' : null
}

export interface TaskSendWho {
  meId: string | null
  assigneeIds: readonly string[]
  /** A person's name for an id, as `taskPersonName` gives it. */
  nameOf: (id: string) => string
}

function onlyMe(who: TaskSendWho): boolean {
  return who.assigneeIds.length === 1 && who.assigneeIds[0] === who.meId
}

/**
 * The words on Send. The button names the act and who it reaches: *Add to my list*, *Send to
 * Theo*, *Send to Theo and Imani*, *Send to 4 people*. With nobody picked it stays *Send* and the
 * window holds it dead.
 */
export function taskSendLabel(who: TaskSendWho): string {
  if (who.assigneeIds.length === 0) return 'Send'
  if (onlyMe(who)) return 'Add to my list'
  if (who.assigneeIds.length > 2) return `Send to ${who.assigneeIds.length} people`
  return `Send to ${joinAnd(who.assigneeIds.map((id) => (id === who.meId ? 'me' : who.nameOf(id))))}`
}

export interface NewTaskSentenceInput extends TaskSendWho {
  /** The words typed in the What box. */
  title: string
  when: 'today' | 'date' | 'repeat'
  repeatMode: 'weekly' | 'after_done'
  startDate: string
  todayStr: string
  /** 0 is Sunday. */
  daysOfWeek: readonly number[]
  daysAfter: number
  endDate: string | null
  staysUntilDone: boolean
  dueDate: string | null
  lineCount: number
  asksForPhoto: boolean
  /** The stored `notify_creator_on_complete`. */
  tellMe: boolean
  /** Who else hears, or null. */
  tellOtherName: string | null
  /**
   * The giver's name when the person at the window is not the giver, as on an edit of someone else's task.
   * The giver is then named where the sentence would say *You*.
   */
  giverName?: string | null
}

export interface NewTaskSentence {
  text: string
  /** True when Send cannot go yet. The text is then the one thing still missing. */
  dead: boolean
}

function whoGetsIt(who: TaskSendWho): string {
  if (onlyMe(who)) return 'It goes on your list'
  if (who.assigneeIds.length > 3) return `${who.assigneeIds.length} people each get it`
  const names = who.assigneeIds.map((id) => (id === who.meId ? 'You' : who.nameOf(id)))
  // "You" leads, so the sentence never opens on a lower-case word.
  names.sort((a, b) => Number(b === 'You') - Number(a === 'You'))
  return names.length === 1 ? `${names[0]} gets it` : `${joinAnd(names)} each get it`
}

function onDay(ymd: string, todayStr: string): string {
  if (ymd === todayStr) return 'today'
  if (ymd === ymdAddDays(todayStr, 1)) return 'tomorrow'
  return `on ${taskDayWords(ymd)}`
}

/**
 * What Send will do, in words, for the bar at the bottom of the window. While something is
 * missing the sentence names it and `dead` is true: the words first, then the people, then the
 * day or the weekdays.
 */
export function newTaskSentence(input: NewTaskSentenceInput): NewTaskSentence {
  if (!input.title.trim()) return { text: 'Type the task first.', dead: true }
  if (input.assigneeIds.length === 0) return { text: 'Pick who it is for.', dead: true }
  const who = whoGetsIt(input)
  const parts: string[] = []

  if (input.when === 'repeat') {
    const start = input.startDate || input.todayStr
    if (input.repeatMode === 'after_done') {
      const n = Math.max(1, input.daysAfter)
      const first = start === input.todayStr ? 'today' : `starting ${taskDayWords(start)}`
      parts.push(`${who} ${first}.`)
      parts.push(`It comes back ${n} day${n === 1 ? '' : 's'} after each time it is done.`)
    } else {
      const days = [...new Set(input.daysOfWeek)].sort((a, b) => a - b)
      if (days.length === 0) return { text: 'Pick at least one weekday.', dead: true }
      const every = days.length === 7 ? 'every day' : `every ${joinAnd(days.map((d) => DAY_SHORT[d] ?? '?'))}`
      parts.push(`${who} ${every}.`)
      const from = start === input.todayStr ? 'It starts today' : `It starts ${taskDayWords(start)}`
      parts.push(input.endDate ? `${from} and ends ${taskDayWords(input.endDate)}.` : `${from}.`)
      if (!days.includes(ymdParts(start)?.dow ?? -1)) parts.push('The first one lands on the next chosen day.')
      parts.push('A missed day does not carry over.')
    }
  } else {
    const day = input.when === 'today' ? input.todayStr : input.startDate
    if (!day) return { text: 'Pick a day.', dead: true }
    if (input.dueDate && input.dueDate < day) return { text: 'The due day is before the task starts.', dead: true }
    parts.push(`${who} ${onDay(day, input.todayStr)}.`)
    if (input.dueDate && input.dueDate !== day) {
      parts.push(`It is late after ${taskDayWords(input.dueDate)}.`)
      parts.push('It stays until it is done.')
    } else {
      parts.push(input.dueDate || input.staysUntilDone ? 'It stays until it is done.' : 'It leaves the list when that day ends.')
    }
  }

  const carries = cardCarries(input.lineCount, input.asksForPhoto)
  if (carries) parts.push(carries)

  const hears: string[] = []
  const giver = input.giverName ?? 'You'
  if (input.tellMe && (input.giverName || !onlyMe(input))) hears.push(giver)
  if (input.tellOtherName) hears.push(input.tellOtherName)
  if (hears.length === 2) parts.push(`${joinAnd(hears)} hear when it is done.`)
  else if (hears[0] === 'You' && !input.giverName) parts.push('You hear when it is done.')
  else if (hears.length === 1) parts.push(`${hears[0]} hears when it is done.`)

  return { text: parts.join(' '), dead: false }
}

// ───────────────────────────────────────────────── a task on a roadmap ──

export interface RoadmapTaskSentenceInput {
  /** The words typed in the What box. */
  title: string
  /** The stage the task joins, as the roadmap names it. */
  stageTitle: string
  /** Who has the task, by name. A roadmap task may have nobody yet. */
  assigneeNames: readonly string[]
  lineCount: number
  asksForPhoto: boolean
  /** The window is changing a task that is already on the roadmap. */
  editing: boolean
}

/**
 * What saving a roadmap task will do, for the bar of its window. A roadmap task has no day of its own: it lands on
 * each person's list when its stage unlocks, so the sentence says that in place of a day.
 */
export function roadmapTaskSentence(input: RoadmapTaskSentenceInput): NewTaskSentence {
  if (!input.title.trim()) return { text: 'Type the task first.', dead: true }
  const parts: string[] = []
  const stage = input.stageTitle.trim()
  if (!input.editing) parts.push(stage ? `It joins the stage ${stage}.` : 'It joins this stage.')
  const names = input.assigneeNames.map((n) => n.trim()).filter(Boolean)
  if (names.length === 0) parts.push('Nobody has it yet.')
  else if (names.length === 1) parts.push(`${names[0]} gets it when the stage unlocks.`)
  else if (names.length <= 3) parts.push(`${joinAnd(names)} each get it when the stage unlocks.`)
  else parts.push(`${names.length} people each get it when the stage unlocks.`)
  const carries = cardCarries(input.lineCount, input.asksForPhoto)
  if (carries) parts.push(carries)
  return { text: parts.join(' '), dead: false }
}
