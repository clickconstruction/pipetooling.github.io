// A Checklist task from the dev seat (v2.7584 / 0.95.0). The owner, 2026-11-17: "Do you have dev-mcp verbs to assign
// tasks and set locations and attach photos? if not help me add them". None did. This file is the first of the three:
// find_task / get_task read a task whole, and plan_task → apply_task give one as the New task window gives it.
//
// The window's send is one kernel now (src/lib/tasks/newTaskSend.ts, read here through the kernel copy): its refusals,
// its checklist_items row, its people's rows and its days. This file shapes the call into the window's draft and runs
// that kernel, so a task given here lands as one given there and neither can drift from the other. The Done when…
// lines and the photo switch's default are the window's own too (taskCriteria.ts, taskProgress.ts), and a place goes
// through the place kernel inside the send.
//
// No RPC exists and none is owed: the window writes its rows under RLS, so the seat does too, as the dev. The dry run
// is this server's read of the people, their lists and the tasks already wearing the words, hashed with the payload;
// apply reads again and writes only when the hash still matches. It tells nobody, as the window tells nobody: a task
// given sends no push, and a reminder goes at its own time. Pure: no env reads, no network, no clock; the reads come
// in through the Reader so the tests run over a fake (src/lib/devMcp/devMcpTasks.test.ts).

import type { Reader, Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { newTaskAssigneeRows, newTaskSend, nextDisplayOrders, type NewTaskDraft } from './gcKernels/lib/tasks/newTaskSend.ts'
import { LINE_CHARS, LINE_MAX, criteriaRows, parseLines } from './gcKernels/lib/taskCriteria.ts'
import { asksForPhotoDefault } from './gcKernels/lib/taskProgress.ts'
import { cleanTaskPlaceName, taskPlaceFromRow, taskTitlePlain, type TaskPlace } from './gcKernels/lib/tasks/taskPlace.ts'
import { isTaskSpotPhotoPath } from './gcKernels/lib/tasks/taskSpotPhoto.ts'
import { isActiveRosterPerson } from './gcKernels/lib/people/activeRoster.ts'
import { resolveTaskRef, taskLikeTerm } from './devMcpTaskRef.ts'
import { PLACE_ASK_SHAPE, findPlace, mapLink, placeAskInput, placeDraft, type CensusGeocode, type PlaceAsk, type PlaceFound } from './devMcpTaskPlace.ts'

export const TASK_VERBS = ['plan_task', 'apply_task'] as const
export type TaskVerb = (typeof TASK_VERBS)[number]

export function isTaskVerb(name: string): name is TaskVerb {
  return (TASK_VERBS as readonly string[]).includes(name)
}

/** The longest words the seat sends as a task. The window's box has no cap; a card past this is a document. */
export const TASK_TEXT_MAX = 2000
/** People on one task through the seat. */
export const TASK_PEOPLE_MAX = 12
export const TASK_LINKS_MAX = 10
const LINK_MAX = 600
const REF_MAX = 200
/** A day row's worth of a get_task reply. */
export const TASK_DAYS_SHOWN = 14
/** Of those, the days ahead of today; the rest are today and the days before it. */
export const TASK_DAYS_AHEAD = 4
const DAY_SELECT = 'id,scheduled_date,completed_at,completed_by_user_id,percent_complete,notes'
export const TASK_THREAD_SHOWN = 15
export const TASK_PHOTOS_SHOWN = 20
const FIND_LIMIT = 20
/** Pages of a person's own list find_task reads, two hundred a page. */
const PERSON_PAGES = 3
/** Open days read for one task in find_task. A weekly task holds five weeks ahead. */
const OPEN_DAYS_READ = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const WEEKDAY_WORDS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const by = (column: string, value: unknown): RowFilter[] => [{ column, op: 'eq', value }]
const likeTerm = taskLikeTerm

/** A real calendar day, YYYY-MM-DD. */
function realDay(ymd: string): boolean {
  if (!YMD_RE.test(ymd)) return false
  const d = new Date(`${ymd}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd
}

// ── the call, shaped ─────────────────────────────────────────────────────────────────────────────────────────────

export type TaskRepeat = { weekdays: number[]; until?: string } | { days_after_done: number }

export type TaskPayload = {
  action: 'give'
  /** Who it is for: users ids (find_person), or names that each find one person the window would offer. */
  for: string[]
  text: string
  /** The day it is for. Left out: today. On a repeat, the day it starts. */
  on?: string
  repeat?: TaskRepeat
  due?: string
  done_when?: string[]
  asks_for_photo?: boolean
  links?: string[]
  keep_until_done?: boolean
  remind_at?: string
  remind_daily?: boolean
  remind_day_before?: boolean
  escalate_after_days?: number
  tell_when_done?: string
  tell_me_when_done?: boolean
  /** Where the work is, said one of four ways (devMcpTaskPlace.ts): a point, an address, a job, or the name of a place in use. */
  place?: PlaceAsk
  allow_duplicate?: boolean
}

export type TaskInput = { ok: true; p: TaskPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE =
  `needs task — { for (a users id from find_person, or a name that finds one person; or a list of them), text (the words), on? (YYYY-MM-DD; left out, today), ` +
  `repeat? ({ weekdays: [mon, wed] or [1, 3] with 0 = Sunday, until? } or { days_after_done: 7 }), due? (YYYY-MM-DD, a one-off only), done_when? (lines, ${LINE_MAX} at most), ` +
  `asks_for_photo?, links?, keep_until_done? (a one-off stays on the list until done; left out, yes), remind_at? (HH:MM), remind_daily?, remind_day_before?, escalate_after_days?, ` +
  `tell_when_done? (a person), tell_me_when_done? (left out, yes), place? (${PLACE_ASK_SHAPE}), allow_duplicate? }.`

/** A weekday as the row holds it, 0 = Sunday: a number, or a name by its first three letters. */
function weekdayOf(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 6 ? v : null
  if (typeof v !== 'string') return null
  const at = WEEKDAYS.indexOf(v.trim().toLowerCase().slice(0, 3) as (typeof WEEKDAYS)[number])
  return at >= 0 && v.trim().length >= 3 ? at : null
}

/**
 * plan_task / apply_task's input, shaped: the people as references, the words trimmed and capped, every day a real
 * one, the repeat one of its two kinds, the lines as the window parses them, the place a whole point. apply_ must
 * quote a 64-hex plan_hash. What the window itself refuses (no day on a weekly repeat, a due day before the start)
 * is left to the window's own kernel, in the dry run.
 */
export function taskInput(verb: TaskVerb, input: Json): TaskInput {
  const src = obj(input.task)
  if (!src) return { ok: false, error: `${verb} ${SHAPE}` }
  const fail = (why: string): TaskInput => ({ ok: false, error: `${verb}: ${why}` })
  const s = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const flag = (k: string): boolean | undefined | 'bad' => (src[k] === undefined || src[k] === null ? undefined : typeof src[k] === 'boolean' ? (src[k] as boolean) : 'bad')

  const rawFor = Array.isArray(src.for) ? src.for : src.for == null ? [] : [src.for]
  const people: string[] = []
  for (const v of rawFor) {
    const ref = typeof v === 'string' ? v.trim() : ''
    if (!ref || ref.length > REF_MAX) return fail(`for names who the task is for: a users id (find_person) or a name, or a list of them. ${SHAPE}`)
    const key = UUID_RE.test(ref) ? ref.toLowerCase() : ref
    if (!people.includes(key)) people.push(key)
  }
  if (people.length === 0) return fail(`for names who the task is for; it is empty. ${SHAPE}`)
  if (people.length > TASK_PEOPLE_MAX) return fail(`for names ${people.length} people; the most is ${TASK_PEOPLE_MAX}.`)

  const text = s('text').replace(/\r\n/g, '\n')
  if (!text) return fail(`text is the task's words; it is empty. ${SHAPE}`)
  if (text.length > TASK_TEXT_MAX) return fail(`text is ${text.length} characters; the most is ${TASK_TEXT_MAX}.`)
  const p: TaskPayload = { action: 'give', for: people, text }

  for (const k of ['on', 'due'] as const) {
    const day = s(k)
    if (src[k] != null && !day) return fail(`${k} is a day, YYYY-MM-DD.`)
    if (!day) continue
    if (!realDay(day)) return fail(`${k} is a day, YYYY-MM-DD; "${day}" is not one.`)
    p[k] = day
  }

  if (src.repeat != null) {
    const r = obj(src.repeat)
    if (!r) return fail('repeat is { weekdays: [mon, wed], until? } or { days_after_done: 7 }.')
    const hasDays = r.weekdays != null
    const hasGap = r.days_after_done != null
    if (hasDays === hasGap) return fail('repeat is one of two kinds: { weekdays, until? } or { days_after_done }, not both and not neither.')
    if (hasDays) {
      if (!Array.isArray(r.weekdays)) return fail('repeat.weekdays is a list: [mon, wed] or [1, 3], with 0 = Sunday.')
      const days: number[] = []
      for (const v of r.weekdays) {
        const d = weekdayOf(v)
        if (d === null) return fail(`repeat.weekdays holds "${String(v)}", which is not a weekday: use mon … sun, or 0 (Sunday) to 6.`)
        if (!days.includes(d)) days.push(d)
      }
      const repeat: { weekdays: number[]; until?: string } = { weekdays: days.sort((a, b) => a - b) }
      const until = typeof r.until === 'string' ? r.until.trim() : ''
      if (r.until != null && !realDay(until)) return fail(`repeat.until is a day, YYYY-MM-DD; "${String(r.until)}" is not one.`)
      if (until) repeat.until = until
      p.repeat = repeat
    } else {
      const gap = r.days_after_done
      if (typeof gap !== 'number' || !Number.isInteger(gap) || gap < 1 || gap > 365) return fail('repeat.days_after_done is a whole number of days, 1 to 365.')
      if (r.until != null) return fail('repeat.until goes with weekdays; a repeat after it is done has no end day.')
      p.repeat = { days_after_done: gap }
    }
    if (p.due) return fail('due goes with a one-off task; a repeating task has no due day, as in the window.')
  }

  if (src.done_when != null) {
    if (!Array.isArray(src.done_when) || src.done_when.some((l) => typeof l !== 'string')) return fail('done_when is a list of lines, each a string.')
    const given = (src.done_when as string[]).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    const long = given.find((l) => l.length > LINE_CHARS)
    if (long) return fail(`a done_when line is ${long.length} characters; the most is ${LINE_CHARS}: "${long.slice(0, 60)}…"`)
    // The window's own parse: a leading bullet stripped, a line typed twice kept once.
    const lines = parseLines(given.join('\n'))
    if (given.length > LINE_MAX && lines.length >= LINE_MAX) return fail(`done_when holds ${given.length} lines; the most is ${LINE_MAX}.`)
    if (lines.length) p.done_when = lines
  }

  for (const k of ['asks_for_photo', 'keep_until_done', 'remind_daily', 'remind_day_before', 'tell_me_when_done', 'allow_duplicate'] as const) {
    const v = flag(k)
    if (v === 'bad') return fail(`${k} is true or false.`)
    if (v !== undefined) p[k] = v
  }

  if (src.links != null) {
    if (!Array.isArray(src.links) || src.links.some((l) => typeof l !== 'string')) return fail('links is a list of addresses, each a string.')
    const links = [...new Set((src.links as string[]).map((l) => l.trim()).filter(Boolean))]
    if (links.length > TASK_LINKS_MAX) return fail(`links holds ${links.length}; the most is ${TASK_LINKS_MAX}.`)
    const bad = links.find((l) => l.length > LINK_MAX || !/^https?:\/\/\S+$/i.test(l))
    if (bad) return fail(`a link must be an http(s) address with no spaces, ${LINK_MAX} characters at most: "${bad.slice(0, 80)}"`)
    if (links.length) p.links = links
  }

  const remindAt = s('remind_at')
  if (src.remind_at != null && !HHMM_RE.test(remindAt)) return fail(`remind_at is a time of day, HH:MM on a 24 hour clock; "${String(src.remind_at)}" is not one.`)
  if (remindAt) p.remind_at = remindAt
  if (src.escalate_after_days != null) {
    const n = src.escalate_after_days
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 60) return fail('escalate_after_days is a whole number of days, 1 to 60.')
    p.escalate_after_days = n
  }
  if (!p.remind_at && (p.remind_daily !== undefined || p.remind_day_before !== undefined || p.escalate_after_days !== undefined)) {
    return fail('remind_daily, remind_day_before and escalate_after_days go with remind_at; without a reminder time the window keeps none of them.')
  }

  const tell = s('tell_when_done')
  if (src.tell_when_done != null && (!tell || tell.length > REF_MAX)) return fail('tell_when_done names one person: a users id (find_person) or a name.')
  if (tell) p.tell_when_done = UUID_RE.test(tell) ? tell.toLowerCase() : tell

  if (src.place != null) {
    const pl = obj(src.place)
    if (!pl) return fail(`place is ${PLACE_ASK_SHAPE}.`)
    const ask = placeAskInput(pl)
    if (!ask.ok) return fail(`place: ${ask.why}`)
    p.place = ask.ask
  }

  let planHash: string | null = null
  if (verb === 'apply_task') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return fail('needs plan_hash — the 64-hex value plan_task replied with.')
    planHash = h
  }
  return { ok: true, p, target: people.join(','), planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

const PERSON_SELECT = 'id,name,role,archived_at,is_digital_twin,is_sample,is_walk_tester,login_attached_at'
/** The roster's predicate as a read's filters (`activeUsersQuery`): never archived, a twin, a sample or the walk tester. */
const ROSTER_FILTERS: RowFilter[] = [
  { column: 'archived_at', op: 'is', value: null },
  { column: 'is_digital_twin', op: 'eq', value: false },
  { column: 'is_sample', op: 'eq', value: false },
  { column: 'is_walk_tester', op: 'eq', value: false },
]

export type TaskPerson = { id: string; name: string; role: string | null }

/** One reference, found: the person, or the reason in words. */
export type PersonFound = { ref: string; person: TaskPerson } | { ref: string; refused: string }

export type TaskWorld = {
  people: PersonFound[]
  tell: PersonFound | null
  /** Each assignee's highest place in their own list, so the new task goes under it. */
  held: Array<{ user_id: string; display_order: number | null }>
  /** Tasks you already gave with these exact words for the same day. */
  already: Array<{ id: string; start_date: string; created_at: string | null; for: string[] }>
  /** The point the call's place stands for; null when the call names no place. */
  place: PlaceFound | null
}

/**
 * Why the New task window would not offer this account, or null when it would. The window's people are
 * `activeUsersQuery(…, { includeDev: true, withLogin: true })`: the roster's own predicate, then a login.
 */
export function notOfferedWhy(row: Row): string | null {
  const name = str(row.name) || 'This account'
  if (row.archived_at != null) return `${name} is archived; a task cannot be given to someone who has left.`
  if (!isActiveRosterPerson(row as { is_digital_twin?: boolean | null; is_sample?: boolean | null; is_walk_tester?: boolean | null; role?: string | null }, { includeDev: true })) {
    return `${name} is a digital twin, a sample or the walk tester; the New task window does not offer them.`
  }
  // The window drops a person with no login: an app task is dead for someone who cannot sign in.
  if (row.login_attached_at === null) return `${name} has no login, so a task would never reach them; plan_login attaches one.`
  return null
}

/** One person by a users id or by a name that finds exactly one account the window would offer. */
async function findOne(reader: Reader, ref: string): Promise<PersonFound> {
  if (UUID_RE.test(ref)) {
    const rows = await reader.rows('users', { select: PERSON_SELECT, filters: by('id', ref), limit: 1 })
    const row = rows[0]
    if (!row) return { ref, refused: `No account ${ref} — pass a users id (find_person gives one).` }
    const why = notOfferedWhy(row)
    return why ? { ref, refused: why } : { ref, person: { id: str(row.id), name: str(row.name), role: strOrNull(row.role) } }
  }
  // The roster's own filters ride in the read, so the twenty rows are all people the window could offer: a short name
  // that also matches archived accounts and twins must not push the one real person past the cut.
  const rows = await reader.rows('users', { select: PERSON_SELECT, filters: [{ column: 'name', op: 'ilike', value: likeTerm(ref) }, ...ROSTER_FILTERS], order: [{ column: 'name' }], limit: FIND_LIMIT })
  const offered = rows.filter((r) => notOfferedWhy(r) === null)
  const exact = offered.filter((r) => str(r.name).trim().toLowerCase() === ref.toLowerCase())
  const pick = exact.length === 1 ? exact[0]! : offered.length === 1 ? offered[0]! : null
  if (pick) return { ref, person: { id: str(pick.id), name: str(pick.name), role: strOrNull(pick.role) } }
  if (offered.length === 0) {
    // Nobody the window offers. One account by that name the window does not offer gets its own reason.
    const any = rows.length ? rows : await reader.rows('users', { select: PERSON_SELECT, filters: [{ column: 'name', op: 'ilike', value: likeTerm(ref) }], order: [{ column: 'name' }], limit: 2 })
    return { ref, refused: any.length === 1 ? (notOfferedWhy(any[0]!) ?? `No one the New task window offers matches "${ref}".`) : `No one the New task window offers matches "${ref}" — find_person lists names.` }
  }
  return { ref, refused: `"${ref}" matches ${offered.length} people — pass the id of one: ${offered.slice(0, 8).map((r) => `${str(r.name)} (${str(r.id)})`).join('; ')}` }
}

/**
 * What the plan reads, as the dev: each person the task is for, the person told when it is done, each assignee's
 * highest place in their own list, and the tasks you already gave with these exact words for the same day.
 */
export async function readTaskWorld(reader: Reader, p: TaskPayload, me: { userId: string }, today: string, census: CensusGeocode): Promise<TaskWorld> {
  const people: PersonFound[] = []
  for (const ref of p.for) people.push(await findOne(reader, ref))
  const tell = p.tell_when_done ? await findOne(reader, p.tell_when_done) : null
  const ids = [...new Set(people.flatMap((f) => ('person' in f ? [f.person.id] : [])))]
  const held: TaskWorld['held'] = []
  for (const id of ids) {
    const rows = await reader.rows('checklist_item_assignees', { select: 'user_id,display_order', filters: by('user_id', id), order: [{ column: 'display_order', ascending: false }], limit: 1 })
    if (rows[0]) held.push({ user_id: id, display_order: typeof rows[0].display_order === 'number' ? rows[0].display_order : null })
  }
  // The words are compared here and never sent as a filter: a long task's words would not fit the door's URL.
  const mine = await reader.rows('checklist_items', {
    select: 'id,title,start_date,created_at',
    filters: [{ column: 'created_by_user_id', op: 'eq', value: me.userId }, { column: 'start_date', op: 'eq', value: p.on ?? today }],
    order: [{ column: 'created_at', ascending: false }],
    limit: 200,
  })
  const same = mine.filter((r) => str(r.title) === p.text).slice(0, 5)
  const already: TaskWorld['already'] = []
  if (same.length) {
    const who = await reader.rows('checklist_item_assignees', { select: 'checklist_item_id,user_id', filters: [{ column: 'checklist_item_id', op: 'in', value: same.map((r) => str(r.id)) }], limit: 200 })
    for (const r of same) already.push({ id: str(r.id), start_date: str(r.start_date), created_at: strOrNull(r.created_at), for: who.filter((w) => str(w.checklist_item_id) === str(r.id)).map((w) => str(w.user_id)) })
  }
  return { people, tell, held, already, place: p.place ? await findPlace(reader, census, p.place) : null }
}

// ── the draft, the dry run and its words ─────────────────────────────────────────────────────────────────────────

/** The stamp the dry run leaves out of its row: the write's own clock, never the plan's. */
const NOW_AT_APPLY = 'stamped when apply writes it'

/** The call as the New task window's draft: what the window would hold at Send, its own defaults where the call says nothing. */
export function taskDraft(p: TaskPayload, people: TaskPerson[], tell: TaskPerson | null, today: string, place: Extract<PlaceFound, { ok: true }> | null = null): NewTaskDraft {
  const lines = p.done_when ?? []
  const weekly = p.repeat && 'weekdays' in p.repeat ? p.repeat : null
  const afterDone = p.repeat && 'days_after_done' in p.repeat ? p.repeat : null
  return {
    typed: p.text,
    title: p.text,
    links: p.links ?? [],
    assigneeIds: people.map((x) => x.id),
    when: p.repeat ? 'repeat' : p.on && p.on !== today ? 'date' : 'today',
    repeatMode: afterDone ? 'after_done' : 'weekly',
    startDate: p.on ?? today,
    repeatDaysOfWeek: weekly ? weekly.weekdays : [],
    repeatDaysAfter: afterDone ? afterDone.days_after_done : 1,
    repeatEndDate: weekly?.until ?? '',
    dueDate: p.due ?? '',
    showUntilCompleted: p.keep_until_done ?? true,
    notifyOnCompleteUserId: tell?.id ?? '',
    notifyCreatorOnComplete: p.tell_me_when_done ?? true,
    reminderTime: p.remind_at ?? '',
    reminderDaily: p.remind_daily ?? true,
    remindDayBefore: p.remind_day_before ?? false,
    escalateEnabled: p.escalate_after_days !== undefined,
    escalateDays: p.escalate_after_days ?? 3,
    // The window's switch: on by itself once a line is written, off on a plain task, until the writer says.
    asksForPhoto: p.asks_for_photo ?? asksForPhotoDefault(lines.length),
    place: place ? placeDraft(place) : null,
    // A place taken by its name brings its way in, as the window's chip sets the task's map with it.
    map: place?.mapId ? { id: place.mapId } : null,
  }
}

/** When the task is for, in words. */
function whenWords(p: TaskPayload, startDate: string, today: string): string {
  if (p.repeat && 'weekdays' in p.repeat) return `every ${p.repeat.weekdays.map((d) => WEEKDAY_WORDS[d]).join(', ')} from ${startDate}${p.repeat.until ? ` until ${p.repeat.until}` : ''}`
  if (p.repeat) return `on ${startDate}, then ${p.repeat.days_after_done} day${p.repeat.days_after_done === 1 ? '' : 's'} after each time it is done`
  return startDate === today ? `today (${today})` : `on ${startDate}`
}

export type TaskDryRun = { ok: true; reply: Json; people: TaskPerson[]; tell: TaskPerson | null; place: Extract<PlaceFound, { ok: true }> | null } | { ok: false; refused: string }

/**
 * The dry run: the people found, the window's own send run on the draft, and what would land. Refused in words for a
 * person the window would not offer, for whatever the window itself refuses, for a day behind today, and for a task
 * you already gave with these words for that day (unless allow_duplicate). The reply's row leaves the place's stamp
 * out and names it under `stamped_at_apply`: a clock in the plan would move the hash between plan and apply.
 */
export function taskDryRun(p: TaskPayload, world: TaskWorld, me: { userId: string; name: string | null }, today: string): TaskDryRun {
  const missed = world.people.flatMap((f) => ('refused' in f ? [f.refused] : []))
  if (missed.length) return { ok: false, refused: missed.join(' ') }
  if (world.tell && 'refused' in world.tell) return { ok: false, refused: `tell_when_done: ${world.tell.refused}` }
  const people = world.people.flatMap((f) => ('person' in f ? [f.person] : []))
  const unique = people.filter((x, i) => people.findIndex((y) => y.id === x.id) === i)
  if (unique.length < people.length) return { ok: false, refused: 'Two of the names in for are the same person; name each person once.' }
  const tell = world.tell && 'person' in world.tell ? world.tell.person : null
  const startDate = p.on ?? today
  if (startDate < today) return { ok: false, refused: `on is ${startDate}, behind today (${today}). The window gives a task for today or a day ahead.` }
  if (p.repeat && 'weekdays' in p.repeat && p.repeat.until && p.repeat.until < startDate) return { ok: false, refused: `repeat.until (${p.repeat.until}) is before the task starts (${startDate}).` }

  if (world.place && !world.place.ok) return { ok: false, refused: `place: ${world.place.refused}` }
  const place = world.place && world.place.ok ? world.place : null
  const draft = taskDraft(p, people, tell, today, place)
  const send = newTaskSend(draft, { userId: me.userId }, { today, now: NOW_AT_APPLY })
  if (!send.ok) return { ok: false, refused: `The New task window refuses this: ${send.error}` }
  if (send.instanceDates.length === 0) return { ok: false, refused: 'This repeat puts no day in the next five weeks, so nobody would see the task. Check the weekdays against the start and the end.' }

  const clash = world.already.filter((a) => a.for.some((id) => people.some((x) => x.id === id)))
  if (clash.length && !p.allow_duplicate) {
    return { ok: false, refused: `You already gave a task with these exact words for ${startDate} to one of these people (${clash.map((a) => a.id).join(', ')}). get_task reads it. If a second one is meant, pass allow_duplicate: true.` }
  }

  const { place_set_at: _stamp, ...row } = send.row
  const lines = p.done_when ?? []
  const names = people.map((x) => x.name)
  const reply: Json = {
    action: 'give',
    reads: `${names.join(', ')} ${names.length === 1 ? 'gets' : 'get'} "${taskTitlePlain(p.text).slice(0, 120)}" ${whenWords(p, startDate, today)}${p.due ? `, due ${p.due}` : ''}.`,
    // Their place in their own list is read again at apply and never held in the plan: a task someone else gives them
    // in between must not turn this plan away.
    for: people.map((x) => ({ id: x.id, name: x.name, role: x.role, lands: 'at the bottom of their list' })),
    given_by: me.name,
    row,
    days: { count: send.instanceDates.length, first: send.instanceDates[0], last: send.instanceDates[send.instanceDates.length - 1], dates: send.instanceDates.slice(0, 8) },
    done_when: lines,
    asks_for_photo: send.row.asks_for_photo,
    place: place ? { name: cleanTaskPlaceName(place.name) || null, lat: place.lat, lng: place.lng, found_by: place.found_by, check_it_here: mapLink(place.lat, place.lng) } : null,
    tells: [
      'Nobody is told when the task is given: the New task window sends no push either. It shows on their Checklist and their Dashboard at once.',
      ...(p.remind_at ? [`A reminder goes at ${p.remind_at} on the day${send.row.remind_day_before ? ' and the day before' : ''}${send.row.reminder_scope === 'today_and_overdue' ? ', and every day after until it is done' : ''}, to whoever has push on.`] : []),
      ...(tell ? [`${tell.name} is told when it is done.`] : []),
      ...(draft.notifyCreatorOnComplete ? ['You are told when it is done.'] : []),
    ],
    does_not: ['tie the task to a job (the window\'s job bar)', 'put a painted map on the task'],
    after: 'plan_task_photo puts the giver\'s photo of the spot on the task once it is given; plan_task_place moves or takes off its place.',
    ...(place ? { stamped_at_apply: ['place_set_at'] } : {}),
    ...(clash.length ? { already_given: clash.map((a) => ({ id: a.id, given_at: a.created_at })) } : {}),
  }
  return { ok: true, reply, people, tell, place }
}

/** The rows an apply writes after the task itself, from the window's own kernels. */
export function taskFollowingRows(itemId: string, p: TaskPayload, world: TaskWorld, people: TaskPerson[], me: { userId: string }) {
  const ids = people.map((x) => x.id)
  return {
    assignees: newTaskAssigneeRows(itemId, ids, nextDisplayOrders(world.held, ids)),
    lines: criteriaRows({ checklistItemId: itemId }, p.done_when ?? [], me.userId),
  }
}

export type TaskStep = { step: string; ok: boolean; rows?: number; why?: string }

/** What apply_task answers with: the task's id, each step's outcome by name, where it shows and the read that lists it. */
export function taskAppliedWords(a: { id: string; reads: string; steps: TaskStep[] }): Json {
  const failed = a.steps.filter((s) => !s.ok)
  return {
    task_id: a.id,
    given: a.reads,
    steps: a.steps,
    ...(failed.length
      ? { not_landed: `The task was given, but ${failed.map((s) => `${s.step} did not land (${s.why ?? 'no reason given'})`).join('; ')}. Open it in Checklist → Manage → Edit to put that right; giving it again would make a second task.` }
      : {}),
    shows: 'On each person\'s Checklist → Today on its day, and in Checklist → Manage for you.',
    next: `get_task with task: "${a.id}" reads it back whole. plan_task_photo with task: "${a.id}" puts a photo of the spot on it.`,
  }
}

// ── find_task and get_task ───────────────────────────────────────────────────────────────────────────────────────

const ITEM_LIST_SELECT = 'id,title,start_date,due_date,repeat_type,repeat_days_of_week,repeat_days_after,created_at,created_by_user_id,place_name,place_lat,place_lng,spot_photo_path'

/** A repeat as the row holds it, in words. */
function repeatWords(row: Row): string {
  if (row.repeat_type === 'day_of_week') {
    const days = Array.isArray(row.repeat_days_of_week) ? (row.repeat_days_of_week as unknown[]).filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6) : []
    return `every ${days.map((d) => WEEKDAY_WORDS[d]).join(', ') || 'week'}${row.repeat_end_date ? ` until ${str(row.repeat_end_date)}` : ''}`
  }
  if (row.repeat_type === 'days_after_completion') return `${str(row.repeat_days_after) || '1'} day(s) after each time it is done`
  return 'once'
}

async function namesOf(reader: Reader, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const rows = await reader.rows('users', { select: 'id,name', filters: [{ column: 'id', op: 'in', value: unique.slice(i, i + 100) }], limit: 200 })
    for (const r of rows) out.set(str(r.id), str(r.name))
  }
  return out
}

export type FindTaskArgs = { text?: string; for?: string }

/**
 * find_task: tasks by their words, by who they are for, or both, newest first, twenty at most. Each match says who it
 * is for, when, whether it carries a place and a photo of the spot, and how many of its days are still open.
 */
export async function findTask(reader: Reader, args: FindTaskArgs): Promise<Json> {
  const text = (args.text ?? '').trim()
  const who = (args.for ?? '').trim()
  if (!text && !who) return { refused: 'find_task needs text (words on the task), for (a person: a users id or a name), or both.' }
  let onlyIds: string[] | null = null
  let person: TaskPerson | null = null
  let listCut = false
  if (who) {
    const found = UUID_RE.test(who)
      ? await reader.rows('users', { select: 'id,name,role', filters: by('id', who.toLowerCase()), limit: 1 })
      : await reader.rows('users', { select: 'id,name,role', filters: [{ column: 'name', op: 'ilike', value: likeTerm(who) }, { column: 'archived_at', op: 'is', value: null }, { column: 'is_digital_twin', op: 'eq', value: false }, { column: 'is_sample', op: 'eq', value: false }], order: [{ column: 'name' }], limit: FIND_LIMIT })
    const exact = found.filter((r) => str(r.name).trim().toLowerCase() === who.toLowerCase())
    const pick = found.length === 1 ? found[0]! : exact.length === 1 ? exact[0]! : null
    if (!pick) return { refused: found.length === 0 ? `No person matches "${who}" — find_person lists names.` : `"${who}" matches ${found.length} people — pass the id of one: ${found.slice(0, 8).map((r) => `${str(r.name)} (${str(r.id)})`).join('; ')}` }
    person = { id: str(pick.id), name: str(pick.name), role: strOrNull(pick.role) }
    // A person's list, newest place first: the tasks they were given last sit at the bottom of it. Read a page at a
    // time below the last place seen, since the door has no offset.
    onlyIds = []
    let below: number | null = null
    for (let page = 0; page < PERSON_PAGES; page += 1) {
      const filters: RowFilter[] = [{ column: 'user_id', op: 'eq', value: person.id }, ...(below === null ? [] : [{ column: 'display_order', op: 'lte' as const, value: below }])]
      const theirs = await reader.rows('checklist_item_assignees', { select: 'checklist_item_id,display_order', filters, order: [{ column: 'display_order', ascending: false }], limit: 200 })
      const fresh = theirs.map((r) => str(r.checklist_item_id)).filter((id) => !onlyIds!.includes(id))
      onlyIds.push(...fresh)
      const last = theirs[theirs.length - 1]
      if (theirs.length < 200 || fresh.length === 0 || typeof last?.display_order !== 'number') break
      below = last.display_order
      if (page === PERSON_PAGES - 1) listCut = true
    }
    if (onlyIds.length === 0) return { for: person, matches: [], reading: `${person.name} has no task.` }
  }
  const words: RowFilter[] = text ? [{ column: 'title', op: 'ilike', value: likeTerm(text) }] : []
  let items: Row[]
  if (onlyIds) {
    // A hundred ids a read: each is about forty characters of the URL, which the door holds to 6,000.
    const found: Row[] = []
    for (let i = 0; i < onlyIds.length; i += 100) found.push(...(await reader.rows('checklist_items', { select: ITEM_LIST_SELECT, filters: [...words, { column: 'id', op: 'in', value: onlyIds.slice(i, i + 100) }], order: [{ column: 'created_at', ascending: false }], limit: FIND_LIMIT })))
    items = found.sort((x, y) => str(y.created_at).localeCompare(str(x.created_at))).slice(0, FIND_LIMIT)
  } else {
    items = await reader.rows('checklist_items', { select: ITEM_LIST_SELECT, filters: words, order: [{ column: 'created_at', ascending: false }], limit: FIND_LIMIT })
  }
  if (items.length === 0) return { ...(person ? { for: person } : {}), matches: [], reading: `No task matches.${listCut ? ` Only the ${onlyIds!.length} tasks lowest in ${person!.name}'s list were searched.` : ''}` }
  const ids = items.map((r) => str(r.id))
  // Each task's open days in a read of its own: one read for all twenty would stop at the door's 200 rows, and a few
  // daily tasks would leave the rest reading as closed.
  const [assignees, ...openByTask] = await Promise.all([
    reader.rows('checklist_item_assignees', { select: 'checklist_item_id,user_id', filters: [{ column: 'checklist_item_id', op: 'in', value: ids }], limit: 200 }),
    ...ids.map((id) => reader.rows('checklist_instances', { select: 'scheduled_date', filters: [{ column: 'checklist_item_id', op: 'eq', value: id }, { column: 'completed_at', op: 'is', value: null }], order: [{ column: 'scheduled_date' }], limit: OPEN_DAYS_READ })),
  ])
  const names = await namesOf(reader, [...assignees.map((a) => str(a.user_id)), ...items.map((r) => str(r.created_by_user_id))])
  const matches = items.map((r, at) => {
    const id = str(r.id)
    const days = openByTask[at] ?? []
    const place = taskPlaceFromRow(r as Parameters<typeof taskPlaceFromRow>[0])
    return {
      id,
      name: taskTitlePlain(str(r.title)).slice(0, 160),
      for: assignees.filter((a) => str(a.checklist_item_id) === id).map((a) => names.get(str(a.user_id)) ?? str(a.user_id)),
      given_by: names.get(str(r.created_by_user_id)) ?? null,
      given_at: strOrNull(r.created_at),
      starts: str(r.start_date),
      due: strOrNull(r.due_date),
      repeats: repeatWords(r),
      open_days: days.length === OPEN_DAYS_READ ? `${OPEN_DAYS_READ} or more` : days.length,
      next_open_day: days[0] ? str(days[0].scheduled_date) : null,
      place: place ? place.name : null,
      photo_of_the_spot: isTaskSpotPhotoPath(strOrNull(r.spot_photo_path)),
    }
  })
  return { ...(person ? { for: person } : {}), matches, reading: `${matches.length} task${matches.length === 1 ? '' : 's'}${matches.length === FIND_LIMIT ? ' (the newest twenty; narrow the words for more)' : ''}${listCut ? `, searched among the ${onlyIds!.length} lowest in ${person!.name}'s list` : ''}. get_task reads one whole by its id; a task from a roadmap may keep its place and photo on the roadmap task, which get_task shows.` }
}

const ITEM_SELECT =
  'id,title,links,start_date,due_date,repeat_type,repeat_days_of_week,repeat_days_after,repeat_end_date,show_until_completed,asks_for_photo,reminder_time,reminder_scope,remind_day_before,escalate_after_days,' +
  'notify_on_complete_user_id,notify_creator_on_complete,created_at,created_by_user_id,roadmap_group_task_id,source_tag,spot_photo_path,place_name,place_lat,place_lng,place_accuracy_m,place_set_by,place_set_at,painted_map_id'

const placeOut = (place: TaskPlace | null, names: Map<string, string>, from: 'task' | 'roadmap task'): Json | null =>
  place ? { name: place.name, lat: place.lat, lng: place.lng, sure_within_m: place.accuracyM, set_by: place.setBy ? (names.get(place.setBy) ?? place.setBy) : null, set_at: place.setAt, on: from, map: mapLink(place.lat, place.lng) } : null

/**
 * get_task: one task whole, by its id or by words that find one. The task as written — its words, who it is for, when,
 * the Done when… lines, the photo switch, its place, whether it carries a photo of the spot — then its newest days
 * with each one's percent, and the newest lines of their thread and their photos. Read as you, under RLS.
 */
export async function getTask(reader: Reader, ref: string, today: string): Promise<Json> {
  const found = await resolveTaskRef(reader, ref, 'get_task')
  if ('refused' in found) return found
  const id = found.id
  const item = (await reader.rows('checklist_items', { select: ITEM_SELECT, filters: by('id', id), limit: 1 }))[0]
  if (!item) return { refused: `No task ${id} — it does not exist, or RLS hides it from you.` }
  // The days around today, never the newest by date: a weekly task holds five weeks ahead, and the newest fourteen of
  // those would hide today's row, its thread and its photos.
  const [assignees, lines, upTo, ahead] = await Promise.all([
    reader.rows('checklist_item_assignees', { select: 'user_id,display_order', filters: by('checklist_item_id', id), order: [{ column: 'display_order' }], limit: 50 }),
    reader.rows('task_criteria', { select: 'id,body,sort_index', filters: [{ column: 'checklist_item_id', op: 'eq', value: id }, { column: 'retired_at', op: 'is', value: null }], order: [{ column: 'sort_index' }], limit: 50 }),
    reader.rows('checklist_instances', { select: DAY_SELECT, filters: [{ column: 'checklist_item_id', op: 'eq', value: id }, { column: 'scheduled_date', op: 'lte', value: today }], order: [{ column: 'scheduled_date', ascending: false }], limit: TASK_DAYS_SHOWN - TASK_DAYS_AHEAD }),
    reader.rows('checklist_instances', { select: DAY_SELECT, filters: [{ column: 'checklist_item_id', op: 'eq', value: id }, { column: 'scheduled_date', op: 'gt', value: today }], order: [{ column: 'scheduled_date' }], limit: TASK_DAYS_AHEAD }),
  ])
  const days = [...[...ahead].reverse(), ...upTo]
  const dayIds = days.map((d) => str(d.id))
  const [thread, photos, roadmap] = await Promise.all([
    dayIds.length ? reader.rows('checklist_instance_events', { select: 'instance_id,event_type,actor_user_id,body,percent,created_at', filters: [{ column: 'instance_id', op: 'in', value: dayIds }], order: [{ column: 'created_at', ascending: false }], limit: TASK_THREAD_SHOWN }) : Promise.resolve([] as Row[]),
    dayIds.length ? reader.rows('task_photos', { select: 'id,instance_id,kind,caption,by_name,taken_at,drive_file_id,fail_why', filters: [{ column: 'instance_id', op: 'in', value: dayIds }], order: [{ column: 'taken_at', ascending: false }], limit: TASK_PHOTOS_SHOWN }) : Promise.resolve([] as Row[]),
    // A task that came from a roadmap keeps its place and its photo on the roadmap task.
    item.roadmap_group_task_id ? reader.rows('checklist_tech_tree_group_tasks', { select: 'id,place_name,place_lat,place_lng,place_accuracy_m,place_set_by,place_set_at,painted_map_id,spot_photo_path', filters: by('id', str(item.roadmap_group_task_id)), limit: 1 }) : Promise.resolve([] as Row[]),
  ])
  const own = taskPlaceFromRow(item as Parameters<typeof taskPlaceFromRow>[0])
  const theirs = own ? null : taskPlaceFromRow((roadmap[0] ?? null) as Parameters<typeof taskPlaceFromRow>[0])
  const names = await namesOf(reader, [
    ...assignees.map((a) => str(a.user_id)),
    str(item.created_by_user_id),
    str(item.notify_on_complete_user_id),
    ...days.map((d) => str(d.completed_by_user_id)),
    ...thread.map((t) => str(t.actor_user_id)),
    str(own?.setBy ?? theirs?.setBy),
  ])
  const dayOf = new Map(days.map((d) => [str(d.id), str(d.scheduled_date)]))
  const open = days.filter((d) => d.completed_at == null)
  const hasPhoto = isTaskSpotPhotoPath(strOrNull(item.spot_photo_path)) || isTaskSpotPhotoPath(strOrNull(roadmap[0]?.spot_photo_path))
  const nextOpen = [...open].reverse().find((d) => str(d.scheduled_date) >= today)
  const oldestOpen = open[open.length - 1]
  return {
    task: {
      id,
      words: taskTitlePlain(str(item.title)),
      as_stored: str(item.title),
      links: Array.isArray(item.links) ? item.links : [],
      for: assignees.map((a) => ({ id: str(a.user_id), name: names.get(str(a.user_id)) ?? null })),
      given_by: names.get(str(item.created_by_user_id)) ?? null,
      given_at: strOrNull(item.created_at),
      starts: str(item.start_date),
      due: strOrNull(item.due_date),
      repeats: repeatWords(item),
      stays_until_done: item.show_until_completed === true,
      asks_for_photo: item.asks_for_photo === true,
      reminder: item.reminder_time ? { at: str(item.reminder_time).slice(0, 5), every_day_until_done: item.reminder_scope !== 'today_only', the_day_before: item.remind_day_before === true, escalates_after_days: item.escalate_after_days ?? null } : null,
      told_when_done: [...(item.notify_on_complete_user_id ? [names.get(str(item.notify_on_complete_user_id)) ?? str(item.notify_on_complete_user_id)] : []), ...(item.notify_creator_on_complete === true ? ['whoever gave it'] : [])],
      from_a_roadmap: item.roadmap_group_task_id != null,
    },
    done_when: lines.map((l) => str(l.body)),
    place: placeOut(own, names, 'task') ?? placeOut(theirs, names, 'roadmap task'),
    painted_map: strOrNull(item.painted_map_id) ?? strOrNull(roadmap[0]?.painted_map_id) ?? null,
    photo_of_the_spot: hasPhoto,
    days_shown: `today and the ${TASK_DAYS_SHOWN - TASK_DAYS_AHEAD - 1} days before it that have a row, and the next ${TASK_DAYS_AHEAD} ahead`,
    days: days.map((d) => ({ id: str(d.id), day: str(d.scheduled_date), done_at: strOrNull(d.completed_at), done_by: d.completed_by_user_id ? (names.get(str(d.completed_by_user_id)) ?? null) : null, percent: typeof d.percent_complete === 'number' ? d.percent_complete : 0, note: strOrNull(d.notes) })),
    thread: thread.map((t) => ({ at: str(t.created_at), day: dayOf.get(str(t.instance_id)) ?? null, by: t.actor_user_id ? (names.get(str(t.actor_user_id)) ?? null) : null, kind: str(t.event_type), text: str(t.body), ...(typeof t.percent === 'number' ? { percent: t.percent } : {}) })),
    photos_on_its_days: photos.map((ph) => ({ id: str(ph.id), day: dayOf.get(str(ph.instance_id)) ?? null, kind: str(ph.kind), caption: str(ph.caption), by: str(ph.by_name), taken_at: str(ph.taken_at), in_drive: ph.drive_file_id != null, ...(ph.fail_why ? { filing_failed: str(ph.fail_why) } : {}) })),
    reading: `${days.length === 0 ? 'No day row yet' : `${open.length} of the ${days.length} day${days.length === 1 ? '' : 's'} shown open`}${nextOpen ? `, the next on ${str(nextOpen.scheduled_date)}` : oldestOpen ? `, the oldest of them ${str(oldestOpen.scheduled_date)}` : ''}; ${lines.length} Done when… line${lines.length === 1 ? '' : 's'}; ${own || theirs ? 'has a place' : 'no place'}; ${hasPhoto ? 'has a photo of the spot' : 'no photo of the spot'}.`,
  }
}
