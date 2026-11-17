// The giver's photo of the spot from the dev seat (v2.7592 / 0.98.0, the third of the task verbs). A task as written
// can carry one picture of where the work is (src/lib/tasks/taskSpotPhoto.ts): the giver adds it in the New task
// window or in Checklist → Manage → Edit, and the person doing the task sees it beside the place. plan_task_photo →
// apply_task_photo put one on a task already given, replace it, or take it off, as the Edit window does: the picture
// into the private task-spot-photos bucket under the task's own name, then the task's `spot_photo_path`.
//
// It is not a photo on a day's card. Those (`task_photos`) are the doer's proof of work, count toward the finishing
// photo a task can ask for and are filed to Drive; a giver's picture among them would let a task close on a photo
// taken before the work began. The app keeps the two apart, and so does this pair: there is no verb for a day's photo.
//
// The bytes never ride in a tool call. The plan commits to the file's size and sha256 and hands back a signed address
// in the dev's own folder of the private dev-seat-staging bucket; the caller PUTs the file there; the apply reads the
// staged copy back, checks its size, its digest and its JPEG header, and only then writes. The app shrinks a picture
// to a JPEG before it saves one and the bucket takes 2 MB, so the seat takes a JPEG of 2 MB at most and says how to
// make one. A task that came from a roadmap keeps its photo on the roadmap task, as its place is kept.
// Pure: no env reads, no network; the reads come in through the Reader (src/lib/devMcp/devMcpTaskPhoto.test.ts).

import type { Reader, Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { taskTitlePlain } from './gcKernels/lib/tasks/taskPlace.ts'
import { TASK_SPOT_PHOTOS_BUCKET, isTaskSpotPhotoPath, taskSpotPhotoPath, taskSpotPhotoTable, type TaskSpotPhotoOwner } from './gcKernels/lib/tasks/taskSpotPhoto.ts'
import { resolveTaskRef } from './devMcpTaskRef.ts'

export { TASK_SPOT_PHOTOS_BUCKET, taskSpotPhotoPath }

export const TASK_PHOTO_VERBS = ['plan_task_photo', 'apply_task_photo'] as const
export type TaskPhotoVerb = (typeof TASK_PHOTO_VERBS)[number]

export function isTaskPhotoVerb(name: string): name is TaskPhotoVerb {
  return (TASK_PHOTO_VERBS as readonly string[]).includes(name)
}

/** The task-spot-photos bucket's own cap (migration 20261113000000). */
export const TASK_SPOT_PHOTO_MAX_BYTES = 2 * 1024 * 1024
/** Where a picture waits between its plan and its apply: the staging bucket a dev reaches only inside their own folder. */
export const TASK_PHOTO_STAGING_BUCKET = 'dev-seat-staging'
export const TASK_PHOTO_MIME = 'image/jpeg'
const REF_MAX = 200
const NAME_MAX = 200

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const by = (column: string, value: unknown): RowFilter[] => [{ column, op: 'eq', value }]

export type TaskPhotoFile = { name: string; size_bytes: number; sha256: string }
export type TaskPhotoPayload = { action: 'put'; task: string; file: TaskPhotoFile; replace?: true } | { action: 'remove'; task: string }

export type TaskPhotoInput = { ok: true; p: TaskPhotoPayload; target: string; planHash: string | null } | { ok: false; error: string }

/** How to make the file the seat takes, on the Mac the agent runs on. */
export const TASK_PHOTO_MAKE_HOW = 'sips -Z 1600 -s format jpeg -s formatOptions 80 "<the picture>" --out spot.jpg ; stat -f%z spot.jpg ; shasum -a 256 spot.jpg'

const SHAPE = `needs photo — { task (a task id from find_task, or words that find one task), file: { name (a .jpg), size_bytes, sha256 }, replace? (true to put it over the photo the task already has) }, or { task, remove: true } to take the photo off. The picture is a JPEG of ${TASK_SPOT_PHOTO_MAX_BYTES / 1024 / 1024} MB at most, as the app saves one: ${TASK_PHOTO_MAKE_HOW}.`

/** plan_task_photo / apply_task_photo's input, shaped. apply_ must quote a 64-hex plan_hash. */
export function taskPhotoInput(verb: TaskPhotoVerb, input: Json): TaskPhotoInput {
  const src = obj(input.photo)
  if (!src) return { ok: false, error: `${verb} ${SHAPE}` }
  const fail = (why: string): TaskPhotoInput => ({ ok: false, error: `${verb}: ${why}` })
  const task = typeof src.task === 'string' ? src.task.trim() : ''
  if (!task || task.length > REF_MAX) return fail(`task names the task — its id (find_task), or words that find one. ${SHAPE}`)
  let p: TaskPhotoPayload
  if (src.remove != null) {
    if (src.remove !== true) return fail('remove is true, or left out.')
    if (src.file != null || src.replace != null) return fail('remove takes the photo off; it goes with no file.')
    p = { action: 'remove', task }
  } else {
    const f = obj(src.file)
    if (!f) return fail(`file is { name, size_bytes, sha256 }. ${SHAPE}`)
    const name = typeof f.name === 'string' ? f.name.trim() : ''
    if (!name || name.length > NAME_MAX || /[\\/]/.test(name)) return fail('file.name is the file\'s own name, with no folder.')
    if (!/\.jpe?g$/i.test(name)) return fail(`file.name must end .jpg: the app saves a photo of the spot as a JPEG. Make one with: ${TASK_PHOTO_MAKE_HOW}`)
    const size = f.size_bytes
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 1) return fail('file.size_bytes is the file\'s size in bytes, a whole number.')
    if (size > TASK_SPOT_PHOTO_MAX_BYTES) return fail(`the file is ${(size / 1024 / 1024).toFixed(1)} MB; a photo of the spot is ${TASK_SPOT_PHOTO_MAX_BYTES / 1024 / 1024} MB at most. Shrink it as the app does: ${TASK_PHOTO_MAKE_HOW}`)
    const sha = typeof f.sha256 === 'string' ? f.sha256.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(sha)) return fail('file.sha256 is the file\'s sha256, 64 hex characters (shasum -a 256).')
    if (src.replace != null && src.replace !== true) return fail('replace is true, or left out.')
    p = { action: 'put', task, file: { name, size_bytes: size, sha256: sha }, ...(src.replace === true ? { replace: true as const } : {}) }
  }
  let planHash: string | null = null
  if (verb === 'apply_task_photo') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return fail('needs plan_hash — the 64-hex value plan_task_photo replied with.')
    planHash = h
  }
  return { ok: true, p, target: task, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type TaskPhotoWorld = {
  task: { id: string; words: string }
  /** What the photo belongs to: the task as written, or its roadmap task when it came from a roadmap. */
  owner: TaskSpotPhotoOwner
  table: 'checklist_items' | 'checklist_tech_tree_group_tasks'
  on: 'task' | 'roadmap task'
  /** The picture there now, as its path in the bucket; null with none, and for a column that holds no path of the one shape. */
  before: string | null
}

/** The task, the row its photo lives on, and the photo there now. */
export async function readTaskPhotoWorld(reader: Reader, p: TaskPhotoPayload, verb: string): Promise<TaskPhotoWorld | { refused: string }> {
  const ref = await resolveTaskRef(reader, p.task, verb)
  if ('refused' in ref) return ref
  const item = (await reader.rows('checklist_items', { select: 'id,title,roadmap_group_task_id,spot_photo_path', filters: by('id', ref.id), limit: 1 }))[0]
  if (!item) return { refused: `No task ${ref.id} — it does not exist, or RLS hides it from you.` }
  let owner: TaskSpotPhotoOwner = { kind: 'item', id: ref.id }
  let row: Row = item
  const roadmapTaskId = strOrNull(item.roadmap_group_task_id)
  if (roadmapTaskId) {
    // A task made from a roadmap comes and goes as stages unlock; its photo stays on the roadmap task, as its place does.
    const task = (await reader.rows('checklist_tech_tree_group_tasks', { select: 'id,spot_photo_path', filters: by('id', roadmapTaskId), limit: 1 }))[0]
    if (!task) return { refused: `This task came from a roadmap, and its roadmap task ${roadmapTaskId} cannot be read, so its photo cannot be set from here.` }
    owner = { kind: 'roadmap', id: roadmapTaskId }
    row = task
  }
  const path = strOrNull(row.spot_photo_path)
  return { task: { id: ref.id, words: taskTitlePlain(str(item.title)) }, owner, table: taskSpotPhotoTable(owner), on: owner.kind === 'item' ? 'task' : 'roadmap task', before: isTaskSpotPhotoPath(path) ? path : null }
}

// ── the staged copy ──────────────────────────────────────────────────────────────────────────────────────────────

/** Where a picture waits: the dev's own folder, the file's digest. The staging bucket's policies hold a dev to their folder. */
export function taskPhotoStagePath(userId: string, file: Pick<TaskPhotoFile, 'sha256'>): string {
  return `${userId}/task-spot-photos/${file.sha256.slice(0, 32)}.jpg`
}

/** The curl line that puts the file at its signed address. */
export const TASK_PHOTO_UPLOAD_HOW = `curl -sS -X PUT "<upload_url>" -H "Content-Type: ${TASK_PHOTO_MIME}" -H "x-upsert: true" --data-binary @"<the file>" — then apply_task_photo with this photo and its plan_hash. The staged copy is read back, checked against size_bytes and sha256, put on the task and removed.`

/** Whether staged bytes are the file the plan named: its size, and a JPEG by its header. The digest is the caller's check. */
export function stagedPhotoProblem(bytes: Uint8Array, file: Pick<TaskPhotoFile, 'size_bytes'>): string | null {
  if (bytes.length !== file.size_bytes) return `The staged file is ${bytes.length} bytes; the plan says ${file.size_bytes}. PUT the file you planned, or plan again with this file's size and sha256.`
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return `The staged file is not a JPEG, whatever its name says. Make one with: ${TASK_PHOTO_MAKE_HOW}`
  return null
}

// ── the dry run and its words ────────────────────────────────────────────────────────────────────────────────────

export type TaskPhotoDryRun = { ok: true; reply: Json } | { ok: false; refused: string }

const WHAT_IT_IS = 'The giver\'s photo of the spot: one picture on the task as written, shown beside its place. It is not a photo on a day\'s card, and it never counts as the finishing photo a task asks for.'

/**
 * The dry run: the task, the photo there now, and what would land. Refused in words for a task that already has a
 * photo (unless replace) and a remove with none to take off. The new picture's own id is made by the write, so the
 * plan names where it lands without it.
 */
export function taskPhotoDryRun(p: TaskPhotoPayload, world: TaskPhotoWorld): TaskPhotoDryRun {
  const head = { action: p.action, task: world.task, on: world.on, has_a_photo_now: world.before != null }
  const words = world.task.words.slice(0, 120)
  if (p.action === 'remove') {
    if (!world.before) return { ok: false, refused: `"${world.task.words}" has no photo of the spot to take off.` }
    return { ok: true, reply: { ...head, reads: `The photo of the spot comes off "${words}".`, removes: world.before, what_it_is: WHAT_IT_IS, tells: 'Nobody is told.' } }
  }
  if (world.before && !p.replace) return { ok: false, refused: `"${world.task.words}" already has a photo of the spot. A task carries one. Pass replace: true to put this one over it; the old picture is taken out of the bucket, as Edit does.` }
  return {
    ok: true,
    reply: {
      ...head,
      reads: world.before ? `A new photo of the spot replaces the one on "${words}".` : `"${words}" gets a photo of the spot.`,
      file: { name: p.file.name, mime: TASK_PHOTO_MIME, size_bytes: p.file.size_bytes, sha256: p.file.sha256 },
      lands: `the private ${TASK_SPOT_PHOTOS_BUCKET} bucket, as ${world.owner.kind}/${world.owner.id}/<a new id>.jpg, and the ${world.on}'s spot_photo_path`,
      ...(world.before ? { replaces: world.before } : {}),
      stamped_at_apply: ['the picture\'s own id in its path'],
      what_it_is: WHAT_IT_IS,
      tells: 'Nobody is told: the picture shows on the task\'s card the next time it is read.',
    },
  }
}

export type TaskPhotoOutcome = { path: string | null; oldRemoved: string | null; stagedRemoved: boolean | null }

/** What apply_task_photo answers with. */
export function taskPhotoAppliedWords(p: TaskPhotoPayload, world: TaskPhotoWorld, reply: Json, out: TaskPhotoOutcome): Json {
  return {
    task_id: world.task.id,
    done: reply.reads,
    on: world.on,
    photo: out.path,
    ...(out.oldRemoved ? { old_picture: `${out.oldRemoved} was taken out of the bucket.` } : {}),
    ...(p.action === 'put' ? { staged_copy: out.stagedRemoved ? 'removed' : 'still in your staging folder; it is only a file, and the next plan for the same picture writes over it' } : {}),
    shows: 'On the task\'s card, beside its place, for whoever the task is for.',
    next: `get_task with task: "${world.task.id}" says whether the task carries a photo of the spot.`,
  }
}
