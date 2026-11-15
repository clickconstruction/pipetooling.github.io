/**
 * Materials on site (punch list #209, v2.7305): the office's press for moving everything a job holds on site to
 * another job — **Move everything on site to another job…** on a job's Materials page and the desk's site row. Pure:
 * who may press, the window's words, the plan `on_site_move_job(p, p_dry_run)` hands back read into rows (the seat's
 * own plan shape, `dev_on_site_move_job`'s since v2.6808, the four tables of 2026-11-13 since v2.7265), the confirm
 * button's words with its counts, and the sentence the page says after. The RPC calls are `onSiteMoveJobIo.ts`'s; the
 * window is `components/materials/OnSiteMoveJobModal.tsx`.
 */
import { countedLabel } from '../batchWords'
import { REFILE_ASK_ROLES } from '../../../supabase/functions/_shared/boxPhotoRefile'

// ---------------------------------------------------------------------------
// Who may press
// ---------------------------------------------------------------------------

/** The roles that may move a job's material: the ones that may combine two jobs, as `on_site_move_job`'s gate names them. */
export const MOVE_JOB_ROLES = REFILE_ASK_ROLES

export function canMoveOnSite(role: string | null | undefined): boolean {
  return (MOVE_JOB_ROLES as readonly string[]).includes(String(role ?? ''))
}

/** The press's words, with the ellipsis a window-opening press carries. */
export const MOVE_JOB_LABEL = 'Move everything on site to another job…'
/** Why the press is dead for everyone else, in the gate's own words. */
export const MOVE_JOB_WHO = 'Only a dev, a master technician, an assistant or a controller moves a job’s material to another job.'
export const MOVE_JOB_TITLE = 'Move everything on site to another job'
/** The press that runs the dry run and draws the plan. */
export const READ_PLAN_LABEL = 'Read the plan'
export const READING_PLAN_WORDS = 'Reading the plan…'
export const MOVING_WORDS = 'Moving…'
/** What the window says before a job is picked. */
export const PICK_WORDS = 'Every cage and box keeps its code and its history. Only the job it sits under changes.'
export const PICK_SOURCE_LABEL = 'The job the material is recorded under'
export const PICK_TARGET_LABEL = 'The job it belongs on'
export const SAME_SITE_HEAD = 'On the same site'
export const SEARCH_TARGET_LABEL = 'Find another job'
export const SEARCH_TARGET_HINT = 'Type a job’s number or name.'
export const NO_TARGET_WORDS = 'Pick the job the material belongs on, then press Read the plan.'

// ---------------------------------------------------------------------------
// The plan, as the database hands it
// ---------------------------------------------------------------------------

/** `on_site_job_counts`' figures for one job. A key the database did not send reads 0. */
export interface OnSiteMoveCounts {
  places: number
  containers: number
  retired_containers: number
  movements: number
  container_moves: number
  photos: number
  part_renames: number
  sticker_runs: number
  ties: number
  prices: number
  site_ties: number
  site_prices: number
  lines_on_hand: number
  parts_on_hand: number
}

export interface OnSiteMoveJobNamed {
  id: string
  label: string
  name: string
}

export interface OnSiteMovePlan {
  dryRun: boolean
  from: OnSiteMoveJobNamed
  to: OnSiteMoveJobNamed
  by: string
  words: string
  /** The rows that moved per table. */
  moved: OnSiteMoveCounts
  placesMerged: Array<{ name: string; containers: number }>
  unsortedFolded: { code: string; intoCode: string; movements: number; containerMoves: number; photos: number } | null
  labelsRenamed: Array<{ code: string; kind: string; from: string; to: string }>
  photos: { rows: number; inDrive: number; waiting: number; words: string }
  ties: { into: 'job' | 'site' | null; dropped: Array<{ a: string; b: string; kept: 'source' | 'target' }>; words: string }
  onHand: { holds: boolean; words: string }
  before: { from: OnSiteMoveCounts; to: OnSiteMoveCounts }
  after: { from: OnSiteMoveCounts; to: OnSiteMoveCounts }
  next: string
}

const COUNT_KEYS: ReadonlyArray<keyof OnSiteMoveCounts> = ['places', 'containers', 'retired_containers', 'movements', 'container_moves', 'photos', 'part_renames', 'sticker_runs', 'ties', 'prices', 'site_ties', 'site_prices', 'lines_on_hand', 'parts_on_hand']

type Json = Record<string, unknown>

function obj(v: unknown): Json | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function counts(v: unknown): OnSiteMoveCounts {
  const o = obj(v) ?? {}
  const out = {} as OnSiteMoveCounts
  for (const k of COUNT_KEYS) out[k] = num(o[k])
  return out
}
function named(v: unknown): OnSiteMoveJobNamed | null {
  const o = obj(v)
  if (!o || typeof o.id !== 'string' || typeof o.label !== 'string') return null
  return { id: o.id, label: o.label, name: str(o.name) }
}

/**
 * Reads the RPC's reply into the plan. Null when it is not a plan: no two jobs, no counts moved, no before and after.
 * Every other key is read with a default, so the seat's older replies (no photos, ties or on_hand) read too.
 */
export function readMovePlan(json: unknown): OnSiteMovePlan | null {
  const r = obj(json)
  if (!r || r.ok !== true) return null
  const from = named(r.from)
  const to = named(r.to)
  const moved = obj(r.moved)
  const before = obj(r.before)
  const after = obj(r.after)
  if (!from || !to || !moved || !before || !after) return null
  const photos = obj(r.photos) ?? {}
  const ties = obj(r.ties) ?? {}
  const onHand = obj(r.on_hand) ?? {}
  const folded = obj(r.unsorted_folded)
  const into = ties.into === 'site' ? 'site' : ties.into === 'job' ? 'job' : null
  return {
    dryRun: r.dry_run === true,
    from,
    to,
    by: str(r.by),
    words: str(r.words),
    moved: counts(moved),
    placesMerged: (Array.isArray(r.places_merged) ? r.places_merged : []).map((p) => ({ name: str(obj(p)?.name), containers: num(obj(p)?.containers) })),
    unsortedFolded: folded ? { code: str(folded.code), intoCode: str(folded.into_code), movements: num(folded.movements), containerMoves: num(folded.container_moves), photos: num(folded.photos) } : null,
    labelsRenamed: (Array.isArray(r.labels_renamed) ? r.labels_renamed : []).map((l) => ({ code: str(obj(l)?.code), kind: str(obj(l)?.kind), from: str(obj(l)?.from), to: str(obj(l)?.to) })),
    photos: { rows: num(photos.rows ?? moved.photos), inDrive: num(photos.in_drive), waiting: num(photos.waiting), words: str(photos.words) },
    ties: { into, dropped: (Array.isArray(ties.dropped) ? ties.dropped : []).map((d) => ({ a: str(obj(d)?.a), b: str(obj(d)?.b), kept: obj(d)?.kept === 'target' ? 'target' : 'source' })), words: str(ties.words) },
    onHand: { holds: onHand.holds !== false, words: str(onHand.words) },
    before: { from: counts(before.from), to: counts(before.to) },
    after: { from: counts(after.from), to: counts(after.to) },
    next: str(r.next),
  }
}

// ---------------------------------------------------------------------------
// The plan as rows
// ---------------------------------------------------------------------------

export interface MovePlanRow {
  key: keyof OnSiteMoveCounts
  label: string
  n: number
}

const MOVED_WORDS: ReadonlyArray<[keyof OnSiteMoveCounts, string, string]> = [
  ['containers', 'cage or box', 'cages and boxes'],
  ['places', 'place', 'places'],
  ['movements', 'press on the ledger', 'presses on the ledger'],
  ['container_moves', 'box move', 'box moves'],
  ['photos', 'photo', 'photos'],
  ['part_renames', 'part rename', 'part renames'],
  ['sticker_runs', 'sticker run', 'sticker runs'],
  ['ties', 'Same part? answer', 'Same part? answers'],
  ['prices', 'price', 'prices'],
]

/** What moves, table by table, only the tables with rows; the retired boxes are said on the boxes' row. */
export function movedRows(plan: OnSiteMovePlan): MovePlanRow[] {
  const rows: MovePlanRow[] = []
  for (const [key, one, many] of MOVED_WORDS) {
    // The places moved are the source's places before: a place that became one with the target's is counted among them.
    const n = key === 'places' ? plan.before.from.places : plan.moved[key]
    if (n <= 0) continue
    let label = n === 1 ? one : many
    if (key === 'containers' && plan.moved.retired_containers > 0) label += plan.moved.retired_containers === 1 ? ', 1 of them retired' : `, ${plan.moved.retired_containers} of them retired`
    rows.push({ key, label, n })
  }
  return rows
}

/** The places that become one with a place of the same name on the target, each with its boxes. */
export function placesFoldedWords(plan: OnSiteMovePlan): string[] {
  const out = plan.placesMerged.map((p) => `${p.name} joins ${plan.to.label}’s ${p.name} with ${p.containers === 1 ? 'its 1 box' : `its ${p.containers} boxes`}.`)
  if (plan.unsortedFolded) {
    const f = plan.unsortedFolded
    out.push(`${plan.from.label}’s Unsorted folds into ${plan.to.label}’s Unsorted with ${f.movements === 1 ? '1 press' : `${f.movements} presses`}.`)
  }
  return out
}

/** Each label the target already holds, and the name its box takes. */
export function labelsChangedWords(plan: OnSiteMovePlan): string[] {
  return plan.labelsRenamed.map((l) => `${l.from} becomes ${l.to}. The code ${l.code} on its label still opens it.`)
}

export interface JobBeforeAfterRow {
  label: string
  name: string
  boxesBefore: number
  boxesAfter: number
  partsBefore: number
  partsAfter: number
}

/** Each job's boxes and parts on hand before and after: the source first, then the target. */
export function beforeAfterRows(plan: OnSiteMovePlan): [JobBeforeAfterRow, JobBeforeAfterRow] {
  const row = (job: OnSiteMoveJobNamed, b: OnSiteMoveCounts, a: OnSiteMoveCounts): JobBeforeAfterRow => ({ label: job.label, name: job.name, boxesBefore: b.containers, boxesAfter: a.containers, partsBefore: b.parts_on_hand, partsAfter: a.parts_on_hand })
  return [row(plan.from, plan.before.from, plan.after.from), row(plan.to, plan.before.to, plan.after.to)]
}

/**
 * Where the photos' files go. The database's own sentence says a file already in Drive stays in the old folder, which
 * was true before v2.6927; since then the move marks every filed photo due and the photo sweep moves the file, so the
 * window says that instead.
 */
export function photosFollowWords(plan: OnSiteMovePlan): string {
  const { rows, inDrive, waiting } = plan.photos
  if (rows <= 0) return 'No photos to move.'
  const head = rows === 1 ? 'The 1 photo moves with its box.' : `The ${rows} photos move with their boxes.`
  const parts: string[] = [head]
  if (inDrive > 0) parts.push(`${inDrive === 1 ? 'Its 1 file' : `${inDrive} files`} already in Drive ${inDrive === 1 ? 'follows' : 'follow'} to ${plan.to.label}’s Drive folder by the photo sweep. That takes a minute or two and finishes by itself.`)
  if (waiting > 0) parts.push(`${waiting === 1 ? '1 file is' : `${waiting} files are`} still waiting to be filed and ${waiting === 1 ? 'lands' : 'land'} in ${plan.to.label}’s folder.`)
  return parts.join(' ')
}

/** The headline over the plan. */
export function planHeadWords(plan: OnSiteMovePlan): string {
  return `Everything on site on ${plan.from.label} moves to ${plan.to.label}.`
}

/**
 * The confirm button: the verb with its counts — *Move 91 boxes and 284 presses to JP1091* — and the target, so the
 * press says exactly what it does. A job with rows in the four tables alone reads *Move everything on site to …*.
 */
export function movePressLabel(plan: OnSiteMovePlan): string {
  const boxes = plan.moved.containers
  const presses = plan.moved.movements
  if (boxes > 0 && presses > 0) return `${countedLabel('Move', boxes, ['box', 'boxes'])} and ${presses} ${presses === 1 ? 'press' : 'presses'} to ${plan.to.label}`
  if (boxes > 0) return `${countedLabel('Move', boxes, ['box', 'boxes'])} to ${plan.to.label}`
  if (presses > 0) return `${countedLabel('Move', presses, ['press', 'presses'])} to ${plan.to.label}`
  return `Move everything on site to ${plan.to.label}`
}

/** The sentence the page says once the move landed, with the photos' sentence when files are on their way. */
export function moveDoneWords(plan: OnSiteMovePlan, photosSentence = ''): string {
  const boxes = plan.moved.containers
  const held = boxes === 0 ? 'what was on site on' : boxes === 1 ? 'the 1 box that was on' : `the ${boxes} boxes that were on`
  const head = `${plan.to.label} now holds ${held} ${plan.from.label}. ${plan.from.label} has nothing on site.`
  const note = ' A note is on both jobs.'
  return `${head}${note}${photosSentence ? ` ${photosSentence}` : ''}`
}

// ---------------------------------------------------------------------------
// Picking the jobs
// ---------------------------------------------------------------------------

export interface MoveJobChoice {
  id: string
  label: string
}

export interface MoveTargetChoices {
  /** The other jobs on the source's site, first. */
  sameSite: MoveJobChoice[]
  /** The jobs the search found, the same-site ones left out. Empty until something is typed. */
  found: MoveJobChoice[]
}

export const MOVE_SEARCH_MAX = 12

/** The receiving job's choices: the jobs on the same site first, then the ones a search finds. */
export function moveTargetChoices(jobs: ReadonlyArray<MoveJobChoice>, sourceId: string | null, siteOfJob: ReadonlyMap<string, string | null | undefined>, query: string): MoveTargetChoices {
  const site = sourceId ? siteOfJob.get(sourceId) ?? null : null
  const sameSite = site ? jobs.filter((j) => j.id !== sourceId && siteOfJob.get(j.id) === site) : []
  const q = query.trim().toLowerCase()
  const found = q
    ? jobs.filter((j) => j.id !== sourceId && !sameSite.some((s) => s.id === j.id) && j.label.toLowerCase().includes(q)).slice(0, MOVE_SEARCH_MAX)
    : []
  return { sameSite, found }
}

/** What stands under the search field. */
export function searchFoundWords(found: ReadonlyArray<MoveJobChoice>, query: string): string | null {
  if (!query.trim()) return null
  if (found.length === 0) return `No job matches “${query.trim()}”.`
  return found.length >= MOVE_SEARCH_MAX ? `The first ${MOVE_SEARCH_MAX}. Type more to narrow them.` : null
}
