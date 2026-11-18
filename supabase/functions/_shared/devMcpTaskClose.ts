// A task closed without the work done, from the dev seat (v2.7823 / 0.103.0, the fourth of the task verbs). The card's
// More offers *No longer applies* on a one-time task (src/lib/tasks/taskDrop.ts, punch list #369): the person says why,
// the day row is marked complete and the thread reads completed, then a dropped line with the reason. That press is one
// function, `task_no_longer_applies` (migration 20261117120000), which holds every rule: the office or a person the
// task is given to, a one-time task, never a roadmap task or a vehicle task, a reason of 3 to 200 characters.
// plan_task_close → apply_task_close call that function as the dev, on a task already given.
//
// It is not *done*. A close this way says the work was not done by the person it was for and why the task leaves the
// list; whoever gave it reopens it to put it back. No verb marks a task done: a completion can ask for a finishing
// photo and Done when… lines, sends the watchers their push and makes a repeat's next day, and those are the doer's.
//
// The dry run is this server's read of the task and its day rows, held to the function's own refusals so a plan never
// ends in one the read could have seen. The reason is refused past its limit, where the function would cut it: the
// plan shows the words the thread will keep. Whoever gave the task is told by the push the card's press sends, unless
// that is the caller. Pure: no env reads, no network; the reads come in through the Reader
// (src/lib/devMcp/devMcpTaskClose.test.ts).

import type { Reader, Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { taskTitlePlain } from './gcKernels/lib/tasks/taskPlace.ts'
import { DROP_REASON_MAX, DROP_REASON_MIN, DROP_TITLE, dropPush, dropReasonTidy, dropRule } from './gcKernels/lib/tasks/taskDrop.ts'
import { resolveTaskRef } from './devMcpTaskRef.ts'

export const TASK_CLOSE_VERBS = ['plan_task_close', 'apply_task_close'] as const
export type TaskCloseVerb = (typeof TASK_CLOSE_VERBS)[number]

export function isTaskCloseVerb(name: string): name is TaskCloseVerb {
  return (TASK_CLOSE_VERBS as readonly string[]).includes(name)
}

/** The card's own function: the one write, and every rule. */
export const TASK_CLOSE_RPC = 'task_no_longer_applies'
const REF_MAX = 200
/** A one-time task has one day row; this many are read so a task with more is named whole. */
const DAYS_READ = 50
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const by = (column: string, value: unknown): RowFilter[] => [{ column, op: 'eq', value }]

export type TaskClosePayload = { task: string; why: string; day?: string }

export type TaskCloseInput = { ok: true; p: TaskClosePayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs close — { task (a task id from find_task, or words that find one task), why (the reason the thread keeps, ${DROP_REASON_MIN} to ${DROP_REASON_MAX} characters), day? (YYYY-MM-DD, only when the task has more than one open day) }. It closes a one-time task as "${DROP_TITLE}": the work is not marked as done by the person it is for.`

/** plan_task_close / apply_task_close's input, shaped. apply_ must quote a 64-hex plan_hash. */
export function taskCloseInput(verb: TaskCloseVerb, input: Json): TaskCloseInput {
  const src = obj(input.close)
  if (!src) return { ok: false, error: `${verb} ${SHAPE}` }
  const fail = (why: string): TaskCloseInput => ({ ok: false, error: `${verb}: ${why}` })
  const task = typeof src.task === 'string' ? src.task.trim() : ''
  if (!task || task.length > REF_MAX) return fail(`task names the task — its id (find_task), or words that find one. ${SHAPE}`)
  if (typeof src.why !== 'string') return fail(`why is the reason in words. ${SHAPE}`)
  // The function cuts a long reason at its limit without a word. The plan shows what the thread will keep, so a
  // reason past the limit is turned away here instead.
  const whole = src.why.replace(/\s+/g, ' ').trim()
  if (whole.length > DROP_REASON_MAX) return fail(`why is ${whole.length} characters; the most is ${DROP_REASON_MAX}. Say it shorter: the thread keeps the reason as one line.`)
  const why = dropReasonTidy(src.why)
  const rule = dropRule(why)
  if (rule) return fail(`why: ${rule} The reason is ${DROP_REASON_MIN} characters at least.`)
  let day: string | undefined
  if (src.day != null) {
    if (typeof src.day !== 'string' || !YMD_RE.test(src.day.trim())) return fail('day is the day row to close, as YYYY-MM-DD, or left out.')
    day = src.day.trim()
  }
  let planHash: string | null = null
  if (verb === 'apply_task_close') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return fail('needs plan_hash — the 64-hex value plan_task_close replied with.')
    planHash = h
  }
  return { ok: true, p: { task, why, ...(day ? { day } : {}) }, target: task, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type TaskCloseDay = { id: string; day: string; done_at: string | null; done_by: string | null }

export type TaskCloseWorld = {
  task: { id: string; words: string }
  /** `once`, or the repeat the function refuses. */
  repeats: string
  roadmap: boolean
  /** Who gave the task; null when the row names nobody or the name cannot be read. */
  giver: { id: string; name: string } | null
  /** Who the task is for, by name. */
  people: string[]
  /** Every day row of the task, oldest first. */
  days: TaskCloseDay[]
  /** The day row the close would land on, when the days and the call pick exactly one. */
  picked: TaskCloseDay | null
  /** The picked row is a vehicle service's task: the office closes it there. */
  vehicle: boolean
}

/** The task, who gave it, who it is for, its day rows and the one a close would land on. */
export async function readTaskCloseWorld(reader: Reader, p: TaskClosePayload, verb: string): Promise<TaskCloseWorld | { refused: string }> {
  const ref = await resolveTaskRef(reader, p.task, verb)
  if ('refused' in ref) return ref
  const item = (await reader.rows('checklist_items', { select: 'id,title,repeat_type,roadmap_group_task_id,created_by_user_id', filters: by('id', ref.id), limit: 1 }))[0]
  if (!item) return { refused: `No task ${ref.id} — it does not exist, or RLS hides it from you.` }
  const [dayRows, assignees] = await Promise.all([
    reader.rows('checklist_instances', { select: 'id,scheduled_date,completed_at,completed_by_user_id', filters: by('checklist_item_id', ref.id), order: [{ column: 'scheduled_date', ascending: true }], limit: DAYS_READ }),
    reader.rows('checklist_item_assignees', { select: 'user_id', filters: by('checklist_item_id', ref.id), limit: 50 }),
  ])
  const giverId = strOrNull(item.created_by_user_id)
  const ids = [...new Set([...(giverId ? [giverId] : []), ...assignees.map((a) => str(a.user_id)).filter(Boolean)])]
  const users: Row[] = ids.length ? await reader.rows('users', { select: 'id,name', filters: [{ column: 'id', op: 'in', value: ids }], limit: ids.length }) : []
  const nameOf = (id: string): string => str(users.find((u) => str(u.id) === id)?.name).trim()
  const days: TaskCloseDay[] = dayRows.map((r) => ({ id: str(r.id), day: str(r.scheduled_date), done_at: strOrNull(r.completed_at), done_by: strOrNull(r.completed_by_user_id) }))
  const open = days.filter((d) => !d.done_at)
  const picked = p.day ? (days.find((d) => d.day === p.day) ?? null) : open.length === 1 ? open[0]! : null
  let vehicle = false
  if (picked) {
    vehicle = (await reader.rows('vehicle_maintenance_tasks', { select: 'id', filters: by('checklist_instance_id', picked.id), limit: 1 })).length > 0
  }
  return {
    task: { id: ref.id, words: taskTitlePlain(str(item.title)) },
    repeats: str(item.repeat_type) || 'once',
    roadmap: strOrNull(item.roadmap_group_task_id) != null,
    giver: giverId ? { id: giverId, name: nameOf(giverId) || 'whoever gave it' } : null,
    people: assignees.map((a) => nameOf(str(a.user_id))).filter(Boolean),
    days,
    picked,
    vehicle,
  }
}

// ── the dry run and its words ────────────────────────────────────────────────────────────────────────────────────

export type TaskCloseDryRun = { ok: true; reply: Json; instanceId: string; tell: { giverId: string; title: string; body: string } | null } | { ok: false; refused: string }

const WHAT_IT_IS = `"${DROP_TITLE}", the close the card's More offers on a one-time task. It says the task leaves the list without the work done, and why. It is not a completion by the person the task is for, and it asks for no finishing photo and no Done when… lines.`

/**
 * The dry run: the task, the day row the close lands on, the words the thread will keep and who is told. Refused in
 * the function's own order and for its own reasons, so the apply does not end in a refusal this read could see.
 */
export function taskCloseDryRun(p: TaskClosePayload, world: TaskCloseWorld, me: { userId: string; name: string }): TaskCloseDryRun {
  const words = world.task.words
  const short = words.slice(0, 120)
  const no = (refused: string): TaskCloseDryRun => ({ ok: false, refused })
  if (world.days.length === 0) return no(`"${words}" has no day row to close. A task with no day is taken off in Checklist → Manage.`)
  const open = world.days.filter((d) => !d.done_at)
  const picked = world.picked
  if (!picked) {
    if (p.day) return no(`"${words}" has no day row on ${p.day}. Its days: ${world.days.map((d) => `${d.day}${d.done_at ? ' (done)' : ''}`).join(', ')}.`)
    if (open.length === 0) return no(`"${words}" is already done: every day row is closed. get_task shows when and by whom.`)
    return no(`"${words}" has ${open.length} open days (${open.map((d) => d.day).join(', ')}). Pass day with the one to close.`)
  }
  if (picked.done_at) return no(`"${words}" is already done for ${picked.day}. get_task shows when and by whom. Whoever gave it reopens it in the app to put it back.`)
  if (world.repeats !== 'once') return no(`"${words}" repeats, and a task that repeats is taken off by whoever gave it, in Checklist → Manage. This close is for a one-time task.`)
  if (world.roadmap) return no(`"${words}" belongs to a roadmap, and its lead takes it off there: closing it here would mark the roadmap task done.`)
  if (world.vehicle) return no(`"${words}" is a vehicle task, and the office closes it on the vehicle: closing it here would mark the service done.`)
  const toldGiver = world.giver && world.giver.id !== me.userId ? world.giver : null
  const push = dropPush(me.name.trim() || 'Someone', short, p.why)
  return {
    ok: true,
    instanceId: picked.id,
    tell: toldGiver ? { giverId: toldGiver.id, title: push.title, body: push.body } : null,
    reply: {
      task: world.task,
      for: world.people,
      given_by: world.giver?.name ?? null,
      day: picked.day,
      day_row: picked.id,
      reads: `"${short}" closes as no longer applying: ${p.why}`,
      why: p.why,
      what_it_is: WHAT_IT_IS,
      writes: [`the day row of ${picked.day} marked complete, by you, at the moment of the apply`, 'a completed line in its thread, which the database writes', `a dropped line after it, with the reason: ${p.why}`],
      through: `${TASK_CLOSE_RPC}, the function behind the card's own press, called as you`,
      put_back: 'Whoever gave the task reopens it in the app, and it is open again with its thread whole.',
      tells: toldGiver ? `${toldGiver.name} gave this task and is told by a push, as the card's press tells them: "${push.body}". The people the task is for are not told.` : 'Nobody is told: you gave this task, and the people it is for get no push.',
      stamped_at_apply: ['the moment it closes'],
    },
  }
}

/** What apply_task_close answers with. `told` is null when nobody was to be told. */
export function taskCloseAppliedWords(world: TaskCloseWorld, reply: Json, out: { doneAt: string | null; told: { name: string; ok: boolean } | null }): Json {
  return {
    task_id: world.task.id,
    done: reply.reads,
    day: reply.day,
    closed_at: out.doneAt,
    ...(out.told ? { told: out.told.ok ? `${out.told.name} was sent the push.` : `${out.told.name} was not told: the push did not go. The thread carries the line either way.` } : {}),
    shows: 'On the task\'s card and in Checklist → History, as closed, no longer applying, with the reason. It is off the open lists.',
    next: `get_task with task: "${world.task.id}" shows the day closed and the thread's two new lines.`,
  }
}
