// A task's place from the dev seat (v2.7589 / 0.96.0, the second of the task verbs). A place is a named point on the
// map (src/lib/tasks/taskPlace.ts): "Pump house", a latitude and a longitude, in columns on the task as written. The
// giver sets one in the New task window's Where row and changes one in Checklist → Manage → Edit, and both write the
// place kernel's columns (`taskPlaceColumns`) on the task's own row under RLS. plan_task_place → apply_task_place do
// the same, as the dev, on a task already given; plan_task takes the same ways of saying a place on a new one.
//
// A person at a desk rarely has a latitude. So a place can be said four ways, and each ends as a point the plan shows
// with a map link before anything lands:
//   - a point: lat and lng;
//   - an address: the app's own saved point for it (`address_geocodes`, the cache `geocode-one` fills), else the
//     Census geocoder. Neither writes anything here: the cache is read, never filled;
//   - a job: its address, found the same way;
//   - like: the name of a place another task already carries, as the window's chips offer it (`recentTaskPlaces`).
//
// The doer's own press, `add_task_place_from_the_spot`, is not the door: it fills a missing place from a phone's
// reading and refuses a reading wider than 46 m, a place already there, and a place with no reading at all. This is
// the giver's write, the Edit window's. A task that came from a roadmap keeps its place on the roadmap task, as the
// app keeps it, so the write lands there. Pure: no env reads, no network; the reads come in through the Reader and
// the geocoder as a function, so the tests run over fakes (src/lib/devMcp/devMcpTaskPlace.test.ts).

import { findJob, resolve, type Reader, type Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { haversineMeters } from './gcKernels/lib/jobTravelEstimate.ts'
import {
  TASK_PLACE_NAME_MAX,
  TASK_PLACE_SELECT,
  cleanTaskPlaceName,
  isTaskPlacePoint,
  recentTaskPlaces,
  taskPlaceColumns,
  taskPlaceDistanceWords,
  taskPlaceFromRow,
  taskTitlePlain,
  type TaskPlace,
  type TaskPlaceColumns,
  type TaskPlaceDraft,
} from './gcKernels/lib/tasks/taskPlace.ts'
import { resolveTaskRef } from './devMcpTaskRef.ts'

export const TASK_PLACE_VERBS = ['plan_task_place', 'apply_task_place'] as const
export type TaskPlaceVerb = (typeof TASK_PLACE_VERBS)[number]

export function isTaskPlaceVerb(name: string): name is TaskPlaceVerb {
  return (TASK_PLACE_VERBS as readonly string[]).includes(name)
}

const ADDRESS_MAX = 300
const REF_MAX = 200
/** Placed tasks read for the names in use; places repeat, so this holds every name a crew uses. */
const PLACED_READ = 200
const NAMES_OFFERED = 60

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const by = (column: string, value: unknown): RowFilter[] => [{ column, op: 'eq', value }]

/** A map link for a point, for the person reading the plan to check before anything lands. */
export const mapLink = (lat: number, lng: number): string => `https://www.google.com/maps?q=${lat},${lng}`

// ── a place, said one of four ways ───────────────────────────────────────────────────────────────────────────────

export type PlaceAsk =
  | { how: 'point'; lat: number; lng: number; name?: string }
  | { how: 'address'; address: string; name?: string }
  | { how: 'job'; job: string; name?: string }
  | { how: 'like'; like: string }

export const PLACE_ASK_SHAPE = '{ lat, lng, name? } (a point), { address, name? } (a street address with its city and state), { job, name? } (a job id, or text that finds one job) or { like } (the name of a place another task already carries)'

/** A place as a call says it: exactly one of the four ways, the name a short one. */
export function placeAskInput(src: Json): { ok: true; ask: PlaceAsk } | { ok: false; why: string } {
  const text = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).replace(/\s+/g, ' ').trim() : '')
  const hasPoint = src.lat != null || src.lng != null
  const ways = [hasPoint, src.address != null, src.job != null, src.like != null].filter(Boolean).length
  if (ways !== 1) return { ok: false, why: `a place is said one way, not ${ways === 0 ? 'none' : 'several'}: ${PLACE_ASK_SHAPE}.` }
  if (src.name != null && typeof src.name !== 'string') return { ok: false, why: 'name is the place in words: "Pump house".' }
  const name = text('name')
  if (name.length > TASK_PLACE_NAME_MAX) return { ok: false, why: `name is ${name.length} characters; the most is ${TASK_PLACE_NAME_MAX}.` }
  const named = name ? { name: cleanTaskPlaceName(name) } : {}
  if (hasPoint) {
    if (!isTaskPlacePoint(src.lat, src.lng)) return { ok: false, why: 'lat and lng are numbers on the globe, both of them. For an address, pass address in their place.' }
    return { ok: true, ask: { how: 'point', lat: src.lat as number, lng: src.lng as number, ...named } }
  }
  if (src.address != null) {
    const address = text('address')
    if (address.length < 6 || address.length > ADDRESS_MAX) return { ok: false, why: `address is a street address with its city and state, ${ADDRESS_MAX} characters at most.` }
    return { ok: true, ask: { how: 'address', address, ...named } }
  }
  if (src.job != null) {
    const job = text('job')
    if (!job || job.length > REF_MAX) return { ok: false, why: 'job is a job id, or text that finds one job (find_job).' }
    return { ok: true, ask: { how: 'job', job, ...named } }
  }
  const like = text('like')
  if (!like || like.length > TASK_PLACE_NAME_MAX) return { ok: false, why: `like is the name of a place another task already carries, ${TASK_PLACE_NAME_MAX} characters at most.` }
  if (name) return { ok: false, why: 'like takes the place as it is named already; name goes with a point, an address or a job.' }
  return { ok: true, ask: { how: 'like', like } }
}

// ── the point behind the words ───────────────────────────────────────────────────────────────────────────────────

/** A geocoder that writes nothing: the Census's, in the function. */
export type CensusGeocode = (address: string) => Promise<{ ok: true; lat: number; lng: number } | { ok: false; error: string; detail?: string }>

/** `mapId` is the painted map that leads to a place in use: a place taken by its name brings its way in, as the window's chip does. */
export type PlaceFound = { ok: true; lat: number; lng: number; name: string; found_by: string; mapId?: string } | { ok: false; refused: string }

/** The key `address_geocodes` holds an address under: `geocode-one`'s own normalizing. */
export function geocodeKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** An address's first line, as a place's name when the call gives none. */
export function placeNameFromAddress(address: string): string {
  return cleanTaskPlaceName(address.split(',')[0] ?? '')
}

async function pointOfAddress(reader: Reader, census: CensusGeocode, address: string): Promise<{ ok: true; lat: number; lng: number; by: string } | { ok: false; refused: string }> {
  // The app's own answer first: the point its maps already draw this address at. Read, never filled.
  const saved = (await reader.rows('address_geocodes', { select: 'lat,lng,geocode_error', filters: by('address_normalized', geocodeKey(address)), limit: 1 }))[0]
  if (saved && !saved.geocode_error && isTaskPlacePoint(saved.lat, saved.lng)) return { ok: true, lat: saved.lat as number, lng: saved.lng as number, by: `the app's saved point for "${address}"` }
  const found = await census(address)
  if (found.ok && isTaskPlacePoint(found.lat, found.lng)) return { ok: true, lat: found.lat, lng: found.lng, by: `the Census geocoder, for "${address}"` }
  const why = !found.ok && found.error === 'census_upstream' ? `the Census geocoder did not answer${found.detail ? ` (${found.detail})` : ''}` : 'the Census geocoder knows no such address'
  return { ok: false, refused: `No point was found for "${address}": the app has no saved point for it, and ${why}. Pass a fuller street address with its city, state and ZIP, or lat and lng.` }
}

/** The places tasks already carry, one a name, newest first: the window's chips, read as you. */
export async function placesInUse(reader: Reader): Promise<TaskPlace[]> {
  const read = (table: 'checklist_items' | 'checklist_tech_tree_group_tasks') =>
    // The door has no "is not null"; a latitude at or above -90 is every row that has one.
    reader.rows(table, { select: TASK_PLACE_SELECT, filters: [{ column: 'place_lat', op: 'gte', value: -90 }], order: [{ column: 'place_set_at', ascending: false }], limit: PLACED_READ })
  const [tasks, roadmapTasks] = await Promise.all([read('checklist_items'), read('checklist_tech_tree_group_tasks')])
  return recentTaskPlaces([...tasks, ...roadmapTasks] as Array<Partial<TaskPlaceColumns>>, NAMES_OFFERED)
}

/** The point a place stands for, however it was said. Throws on a refused read; answers in words when nothing is found. */
export async function findPlace(reader: Reader, census: CensusGeocode, ask: PlaceAsk): Promise<PlaceFound> {
  if (ask.how === 'point') return { ok: true, lat: ask.lat, lng: ask.lng, name: ask.name ?? '', found_by: 'the point you gave' }
  if (ask.how === 'address') {
    const at = await pointOfAddress(reader, census, ask.address)
    return at.ok ? { ok: true, lat: at.lat, lng: at.lng, name: ask.name ?? placeNameFromAddress(ask.address), found_by: at.by } : at
  }
  if (ask.how === 'job') {
    const resolved = await resolve(ask.job, () => findJob(reader, ask.job) as Promise<{ matches: Row[] }>, 'job')
    if ('refused' in resolved) return { ok: false, refused: resolved.refused }
    const job = (await reader.rows('jobs_ledger', { select: 'id,job_name,job_address', filters: by('id', resolved.id), limit: 1 }))[0]
    if (!job) return { ok: false, refused: `No job ${resolved.id} — it does not exist, or RLS hides it from you.` }
    const address = str(job.job_address).replace(/\s+/g, ' ').trim()
    if (!address) return { ok: false, refused: `The job "${str(job.job_name)}" has no address, so it has no point. Pass address, or lat and lng.` }
    const at = await pointOfAddress(reader, census, address)
    return at.ok ? { ok: true, lat: at.lat, lng: at.lng, name: ask.name ?? cleanTaskPlaceName(str(job.job_name)), found_by: `the job "${str(job.job_name)}": ${at.by}` } : at
  }
  const offered = await placesInUse(reader)
  const want = ask.like.toLowerCase()
  const exact = offered.filter((o) => o.name.toLowerCase() === want)
  const holds = offered.filter((o) => o.name.toLowerCase().includes(want))
  const pick = exact[0] ?? (holds.length === 1 ? holds[0]! : null)
  if (pick) return { ok: true, lat: pick.lat, lng: pick.lng, name: pick.name, found_by: `the place "${pick.name}" another task already carries`, ...(pick.mapId ? { mapId: pick.mapId } : {}) }
  if (holds.length > 1) return { ok: false, refused: `"${ask.like}" matches ${holds.length} places — name one whole: ${holds.slice(0, 12).map((o) => o.name).join('; ')}.` }
  return { ok: false, refused: `No task carries a place named "${ask.like}". ${offered.length ? `The names in use: ${offered.slice(0, 20).map((o) => o.name).join('; ')}.` : 'No task carries a named place yet.'} Pass a point, an address or a job.` }
}

/** A found place as the window's draft: set from a map, never from a phone's reading, so it carries no margin. */
export function placeDraft(found: Extract<PlaceFound, { ok: true }>): TaskPlaceDraft {
  return { lat: found.lat, lng: found.lng, name: found.name, accuracyM: null, ...(found.mapId ? { mapId: found.mapId } : {}) }
}

// ── plan_task_place / apply_task_place ───────────────────────────────────────────────────────────────────────────

export type TaskPlacePayload = { action: 'set'; task: string; ask: PlaceAsk } | { action: 'clear'; task: string }

export type TaskPlaceInput = { ok: true; p: TaskPlacePayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs place — { task (a task id from find_task, or words that find one task), and then ${PLACE_ASK_SHAPE}, or clear: true to take the place off }.`

/** plan_task_place / apply_task_place's input, shaped. apply_ must quote a 64-hex plan_hash. */
export function taskPlaceInput(verb: TaskPlaceVerb, input: Json): TaskPlaceInput {
  const src = obj(input.place)
  if (!src) return { ok: false, error: `${verb} ${SHAPE}` }
  const task = typeof src.task === 'string' ? src.task.trim() : ''
  if (!task || task.length > REF_MAX) return { ok: false, error: `${verb}: task names the task — its id (find_task), or words that find one. ${SHAPE}` }
  let p: TaskPlacePayload
  if (src.clear != null) {
    if (src.clear !== true) return { ok: false, error: `${verb}: clear is true, or left out.` }
    if (['lat', 'lng', 'address', 'job', 'like', 'name'].some((k) => src[k] != null)) return { ok: false, error: `${verb}: clear takes the place off; it goes with no place.` }
    p = { action: 'clear', task }
  } else {
    const ask = placeAskInput(src)
    if (!ask.ok) return { ok: false, error: `${verb}: ${ask.why}` }
    p = { action: 'set', task, ask: ask.ask }
  }
  let planHash: string | null = null
  if (verb === 'apply_task_place') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_task_place replied with.` }
    planHash = h
  }
  return { ok: true, p, target: task, planHash }
}

/** Where a task's place is written: its own row, or its roadmap task's when it came from a roadmap. */
export type PlaceHome = { table: 'checklist_items' | 'checklist_tech_tree_group_tasks'; rowId: string; on: 'task' | 'roadmap task' }

export type TaskPlaceWorld = {
  task: { id: string; words: string }
  home: PlaceHome
  before: TaskPlace | null
  /** The painted map on the row, with or without a place. */
  mapBefore: string | null
  found: PlaceFound | null
}

/** The task, the row its place lives on, the place there now, and the point the call stands for. */
export async function readTaskPlaceWorld(reader: Reader, census: CensusGeocode, p: TaskPlacePayload, verb: string): Promise<TaskPlaceWorld | { refused: string }> {
  const ref = await resolveTaskRef(reader, p.task, verb)
  if ('refused' in ref) return ref
  const item = (await reader.rows('checklist_items', { select: `id,title,roadmap_group_task_id,${TASK_PLACE_SELECT}`, filters: by('id', ref.id), limit: 1 }))[0]
  if (!item) return { refused: `No task ${ref.id} — it does not exist, or RLS hides it from you.` }
  let home: PlaceHome = { table: 'checklist_items', rowId: ref.id, on: 'task' }
  let row: Row = item
  const roadmapTaskId = strOrNull(item.roadmap_group_task_id)
  // A task made from a roadmap comes and goes as stages unlock, so its place stays on the roadmap task. But the card
  // reads the task's own row first (`loadTaskWheresForItems`): where that row already holds a place, that is the place
  // the person sees, and the one this verb moves or takes off.
  if (roadmapTaskId && !taskPlaceFromRow(item as Partial<TaskPlaceColumns>)) {
    const task = (await reader.rows('checklist_tech_tree_group_tasks', { select: `id,${TASK_PLACE_SELECT}`, filters: by('id', roadmapTaskId), limit: 1 }))[0]
    if (!task) return { refused: `This task came from a roadmap, and its roadmap task ${roadmapTaskId} cannot be read, so its place cannot be set from here.` }
    home = { table: 'checklist_tech_tree_group_tasks', rowId: roadmapTaskId, on: 'roadmap task' }
    row = task
  }
  return {
    task: { id: ref.id, words: taskTitlePlain(str(item.title)) },
    home,
    before: taskPlaceFromRow(row as Partial<TaskPlaceColumns>),
    mapBefore: strOrNull(row.painted_map_id),
    found: p.action === 'set' ? await findPlace(reader, census, p.ask) : null,
  }
}

/**
 * The task's painted map after the place changes, as the task windows decide it (`taskMapDraftFromSaved` then
 * `taskMapAfterPlace` in src/lib/tasks/taskMapPick.ts, held equal by the test): a place that brings a way in makes
 * that the task's map; otherwise a map on a task that has a place is that place's way in, and leaves when the place
 * moves or goes; and a map on a task with no place is the giver's own pick, and stays.
 */
export function mapAfterPlaceChange(before: TaskPlace | null, mapBefore: string | null, nextMapId: string | null = null): string | null {
  if (nextMapId) return nextMapId
  return before ? null : mapBefore
}

const placeWords = (pl: { name: string | null; lat: number; lng: number }) => ({ name: pl.name, lat: pl.lat, lng: pl.lng, map: mapLink(pl.lat, pl.lng) })

export type TaskPlaceDryRun = { ok: true; reply: Json; patch: Record<string, unknown> } | { ok: false; refused: string }

/**
 * The dry run: what the row holds now, what it would hold, and how far the place moves. Refused in words for a place
 * that cannot be found, a place already there, and a clear with nothing to take off. The reply's patch leaves the
 * stamps out and names them under `stamped_at_apply`.
 */
export function taskPlaceDryRun(p: TaskPlacePayload, world: TaskPlaceWorld, me: { userId: string }): TaskPlaceDryRun {
  const before = world.before
  const head = { action: p.action, task: world.task, on: world.home.on }
  const beforeOut = before ? { ...placeWords(before), ...(world.mapBefore ? { painted_map: world.mapBefore } : {}) } : null
  const tells = 'Nobody is told: the place shows on the task\'s card and on the tasks map the next time they are read.'
  if (p.action === 'clear') {
    if (!before) return { ok: false, refused: `"${world.task.words}" has no place to take off.` }
    const patch = { ...taskPlaceColumns(null, me.userId, '') } as Record<string, unknown>
    return {
      ok: true,
      patch,
      reply: { ...head, reads: `The place "${before.name}" comes off "${world.task.words.slice(0, 120)}".`, before: beforeOut, after: null, ...(world.mapBefore ? { painted_map: 'The painted map that leads to the place comes off with it, as in the Edit window.' } : {}), patch, ...(world.home.table === 'checklist_items' ? { stamped_at_apply: ['updated_at'] } : {}), tells },
    }
  }
  const found = world.found
  if (!found) return { ok: false, refused: 'No place was read for this plan.' }
  if (!found.ok) return { ok: false, refused: found.refused }
  const draft = placeDraft(found)
  const name = cleanTaskPlaceName(found.name) || null
  const samePoint = before != null && before.lat === found.lat && before.lng === found.lng
  // The same point under the same name is no change. The windows' own test (`taskPlaceDraftChanged`) also reads the
  // phone's margin, which a place set from here never carries: by that test a place a phone set would be "changed" by
  // naming it again, and the write would drop its margin and its map for nothing.
  if (before && samePoint && (cleanTaskPlaceName(before.name) || null) === (name ?? cleanTaskPlaceName(before.name))) {
    return { ok: false, refused: `"${world.task.words}" already has this place: "${before.name}" at ${before.lat}, ${before.lng}.` }
  }
  const mapAfter = mapAfterPlaceChange(before, world.mapBefore, found.mapId ?? null)
  const { place_set_at: _stamp, ...columns } = { ...taskPlaceColumns(draft, me.userId, ''), painted_map_id: mapAfter }
  const patch = columns as Record<string, unknown>
  const moved = before ? taskPlaceDistanceWords(haversineMeters(before, found)) : null
  return {
    ok: true,
    patch,
    reply: {
      ...head,
      reads: before && samePoint ? `The place of "${world.task.words.slice(0, 120)}" keeps its point and is named ${name ? `"${name}"` : 'nothing'} in place of "${before.name}".` : before ? `The place of "${world.task.words.slice(0, 120)}" moves ${moved} from "${before.name}" to ${name ? `"${name}"` : 'a place with no name'}.` : `"${world.task.words.slice(0, 120)}" gets a place: ${name ? `"${name}"` : 'one with no name'}.`,
      before: beforeOut,
      after: { ...placeWords({ name, lat: found.lat, lng: found.lng }), check_it_here: mapLink(found.lat, found.lng) },
      found_by: found.found_by,
      ...(name ? {} : { no_name: 'A place with no name reads "A place" on the card and is not offered as a chip. Pass name to say what it is.' }),
      ...(found.mapId ? { painted_map: 'The place brings the painted map that leads to it, as its chip does in the window.' } : before && world.mapBefore ? { painted_map: 'The painted map that led to the old place comes off, as in the Edit window: it was that place\'s way in.' } : world.mapBefore ? { painted_map: 'The task\'s painted map stays.' } : {}),
      patch,
      stamped_at_apply: world.home.table === 'checklist_items' ? ['place_set_at', 'updated_at'] : ['place_set_at'],
      tells,
    },
  }
}

/** The patch as the apply sends it: the plan's columns, and the write's own clock where the plan left a stamp out. */
export function taskPlacePatch(p: TaskPlacePayload, patch: Record<string, unknown>, home: PlaceHome, now: string): Record<string, unknown> {
  return { ...patch, ...(p.action === 'set' ? { place_set_at: now } : {}), ...(home.table === 'checklist_items' ? { updated_at: now } : {}) }
}

/** What apply_task_place answers with. */
export function taskPlaceAppliedWords(world: TaskPlaceWorld, reply: Json): Json {
  return {
    task_id: world.task.id,
    done: reply.reads,
    place: reply.after ?? null,
    on: world.home.on,
    shows: 'On the task\'s card (the place line and its map) and on the tasks map.',
    next: `get_task with task: "${world.task.id}" reads it back.`,
  }
}
