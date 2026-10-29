/**
 * Materials on site (punch list #209): the on-site store. A cache of each job's places, containers,
 * moves, movements and photo notes over the tables of `20261029010000_materials_on_site.sql`, with
 * the io beside it. Reads are plain functions over the cache, so a screen renders without waiting;
 * `loadJob` fills a job and `loadDesk` every job with a live container. A write lands in the cache at
 * once and goes to the table behind it; when the table refuses, the error handler hears why and the
 * job is read again, so the screen shows the truth. The ledger is append-only: a movement is never
 * edited. Prices typed off an invoice are remembered on this device until the parts book's prices
 * are wired (`priceOf`, `rememberPrice`).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { UNSORTED_LABEL, type Container, type ContainerKind, type ContainerMove, type Movement, type MovementReason, type Place } from './onSite'
import { boxCode } from './labels'
import type { PhotoNote, PhotoStatus } from './photo'

// The tables are younger than the generated types; the next types PR removes this cast.
const db = supabase as unknown as SupabaseClient

const PRICES_KEY = 'pt.onSite.prices.v1'
/** The most rows one job's ledger reads at once; a job past this gets a summary RPC (noted on the card). */
export const MOVEMENTS_LIMIT = 5000

type JobCache = {
  places: Place[]
  containers: Container[]
  moves: ContainerMove[]
  movements: Movement[]
  photos: PhotoNote[]
  loadedAt: number | null
  loading: boolean
  error: string | null
  /** The failure as thrown, for the offline panel's class (a lost signal retries by itself; a refusal does not). */
  raw: unknown
}

export type LoadState = { loaded: boolean; loading: boolean; error: string | null; raw: unknown }

const jobs = new Map<string, JobCache>()
const inflight = new Map<string, Promise<void>>()
let deskIds: string[] | null = null
let deskLoading = false
let deskError: string | null = null
let deskRaw: unknown = null
let deskPromise: Promise<string[]> | null = null
let version = 0
const listeners = new Set<() => void>()

function bump(): void {
  version += 1
  for (const l of listeners) l()
}

function cacheOf(jobId: string): JobCache {
  let c = jobs.get(jobId)
  if (!c) {
    c = { places: [], containers: [], moves: [], movements: [], photos: [], loadedAt: null, loading: false, error: null, raw: null }
    jobs.set(jobId, c)
  }
  return c
}

export function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** For `useSyncExternalStore`: a number that changes on every write and every load. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function getVersion(): number {
  return version
}

// ---------------------------------------------------------------------------
// Rows ↔ the kernel's shapes
// ---------------------------------------------------------------------------

type PlaceRow = { id: string; job_id: string; name: string; created_at: string }
type ContainerRow = { id: string; job_id: string; label: string; kind: ContainerKind; where_note: string; place_id: string | null; lat: number | null; lng: number | null; retired_at: string | null; created_at: string }
type MoveRow = { id: string; container_id: string; from_place_id: string | null; to_place_id: string | null; by_name: string; at: string }
type MovementRow = { id: string; job_id: string; part_id: string | null; part_name: string; manufacturer: string | null; quantity: number; reason: MovementReason; from_container_id: string | null; to_container_id: string | null; note: string; source: string | null; item_id: string | null; by_user_id: string | null; by_name: string; at: string }
type PhotoRow = { id: string; job_id: string; container_id: string; by_user_id: string | null; by_name: string; words: string; file_name: string; taken_at: string; bytes: number; width: number; height: number; status: PhotoStatus; storage_path: string | null; drive_file_id: string | null; filed_at: string | null; fail_why: string | null }

const PLACE_COLS = 'id, job_id, name, created_at'
const CONTAINER_COLS = 'id, job_id, label, kind, where_note, place_id, lat, lng, retired_at, created_at'
const MOVE_COLS = 'id, container_id, from_place_id, to_place_id, by_name, at'
const MOVEMENT_COLS = 'id, job_id, part_id, part_name, manufacturer, quantity, reason, from_container_id, to_container_id, note, source, item_id, by_user_id, by_name, at'
const PHOTO_COLS = 'id, job_id, container_id, by_user_id, by_name, words, file_name, taken_at, bytes, width, height, status, storage_path, drive_file_id, filed_at, fail_why'

const placeOf = (r: PlaceRow): Place => ({ id: r.id, jobId: r.job_id, name: r.name, createdAt: r.created_at })
const containerOf = (r: ContainerRow): Container => ({ id: r.id, jobId: r.job_id, label: r.label, kind: r.kind, where: r.where_note ?? '', locationId: r.place_id, lat: r.lat, lng: r.lng, retiredAt: r.retired_at, createdAt: r.created_at })
const moveOf = (r: MoveRow, jobId: string): ContainerMove => ({ id: r.id, jobId, containerId: r.container_id, fromLocationId: r.from_place_id, toLocationId: r.to_place_id, byName: r.by_name ?? '', at: r.at })
const movementOf = (r: MovementRow): Movement => ({ id: r.id, jobId: r.job_id, partId: r.part_id, partName: r.part_name, manufacturer: r.manufacturer, quantity: r.quantity, reason: r.reason, fromContainerId: r.from_container_id, toContainerId: r.to_container_id, note: r.note ?? '', byUserId: r.by_user_id, byName: r.by_name ?? '', at: r.at, source: r.source, itemId: r.item_id })
const photoOf = (r: PhotoRow): PhotoNote => ({ id: r.id, jobId: r.job_id, containerId: r.container_id, fileName: r.file_name, byUserId: r.by_user_id, byName: r.by_name ?? '', at: r.taken_at, bytes: r.bytes ?? 0, width: r.width ?? 0, height: r.height ?? 0, status: r.status, driveFileId: r.drive_file_id, storagePath: r.storage_path, words: r.words ?? '' })

// ---------------------------------------------------------------------------
// Loads
// ---------------------------------------------------------------------------

export function jobLoadState(jobId: string): LoadState {
  const c = jobs.get(jobId)
  return { loaded: Boolean(c?.loadedAt), loading: Boolean(c?.loading), error: c?.error ?? null, raw: c?.raw ?? null }
}

export function deskLoadState(): LoadState {
  return { loaded: deskIds != null, loading: deskLoading, error: deskError, raw: deskRaw }
}

/** One job's places, containers, moves, movements and photo notes into the cache. A second call while the first runs waits on it. */
export function loadJob(jobId: string, opts: { force?: boolean } = {}): Promise<void> {
  const running = inflight.get(jobId)
  if (running && !opts.force) return running
  const c = cacheOf(jobId)
  if (c.loadedAt && !opts.force && !c.error) return Promise.resolve()
  c.loading = true
  c.error = null
  c.raw = null
  bump()
  const p = (async () => {
    try {
      const [places, containers, movements, photos] = await Promise.all([
        db.from('job_places').select(PLACE_COLS).eq('job_id', jobId).order('name'),
        db.from('job_containers').select(CONTAINER_COLS).eq('job_id', jobId).order('created_at'),
        db.from('job_material_movements').select(MOVEMENT_COLS).eq('job_id', jobId).order('at', { ascending: true }).limit(MOVEMENTS_LIMIT),
        db.from('job_box_photos').select(PHOTO_COLS).eq('job_id', jobId).order('taken_at', { ascending: true }),
      ])
      for (const r of [places, containers, movements, photos]) if (r.error) throw r.error
      const containerRows = (containers.data ?? []) as ContainerRow[]
      const ids = containerRows.map((r) => r.id)
      const moves = ids.length ? await db.from('job_container_moves').select(MOVE_COLS).in('container_id', ids).order('at', { ascending: true }) : { data: [] as MoveRow[], error: null }
      if (moves.error) throw moves.error
      c.places = ((places.data ?? []) as PlaceRow[]).map(placeOf)
      c.containers = containerRows.map(containerOf)
      c.movements = ((movements.data ?? []) as MovementRow[]).map(movementOf)
      c.photos = ((photos.data ?? []) as PhotoRow[]).map(photoOf)
      c.moves = ((moves.data ?? []) as MoveRow[]).map((r) => moveOf(r, jobId))
      c.loadedAt = Date.now()
    } catch (e) {
      c.error = formatErrorMessage(e, 'The boxes on this job did not load.')
      c.raw = e
    } finally {
      c.loading = false
      inflight.delete(jobId)
      bump()
    }
  })()
  inflight.set(jobId, p)
  return p
}

/** Every job with a live container, each loaded: the desk across jobs, the tools menu's count, the header's box search. */
export function loadDesk(opts: { force?: boolean } = {}): Promise<string[]> {
  if (deskPromise && !opts.force) return deskPromise
  if (deskIds && !opts.force) return Promise.resolve(deskIds)
  deskLoading = true
  deskError = null
  deskRaw = null
  bump()
  deskPromise = (async () => {
    try {
      const { data, error } = await db.from('job_containers').select('job_id').is('retired_at', null).limit(5000)
      if (error) throw error
      const ids = [...new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id))]
      await Promise.all(ids.map((id) => loadJob(id, opts)))
      deskIds = ids
      return ids
    } catch (e) {
      deskError = formatErrorMessage(e, 'The materials desk did not load.')
      deskRaw = e
      return deskIds ?? []
    } finally {
      deskLoading = false
      deskPromise = null
      bump()
    }
  })()
  return deskPromise
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listPlaces(jobId: string): Place[] {
  return [...cacheOf(jobId).places].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export function listContainers(jobId: string): Container[] {
  return [...cacheOf(jobId).containers].sort((a, b) => (a.kind === 'unsorted' ? -1 : b.kind === 'unsorted' ? 1 : a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })))
}

export function listMovements(jobId: string): Movement[] {
  return cacheOf(jobId).movements
}

export function listContainerMoves(jobId: string): ContainerMove[] {
  return cacheOf(jobId).moves
}

export function listPhotos(jobId: string): PhotoNote[] {
  return cacheOf(jobId).photos
}

/** The jobs the desk knows: those with a live container, once `loadDesk` has run, else the ones loaded so far. */
export function jobIdsWithData(): string[] {
  if (deskIds) return deskIds
  return [...jobs.entries()].filter(([, c]) => c.containers.some((x) => !x.retiredAt)).map(([id]) => id)
}

/** The box a label's code names, from the cache. */
export function findContainerByCode(code: string): Container | null {
  for (const c of jobs.values()) {
    const hit = c.containers.find((x) => !x.retiredAt && boxCode(x.id) === code)
    if (hit) return hit
  }
  return null
}

/** The box a label's code names, from the table: the door a scanned code opens on any phone. */
export async function fetchContainerByCode(code: string): Promise<Container | null> {
  const cached = findContainerByCode(code)
  if (cached) return cached
  const { data, error } = await db.from('job_containers').select(CONTAINER_COLS).eq('code', code).is('retired_at', null).limit(1)
  if (error) throw error
  const row = ((data ?? []) as ContainerRow[])[0]
  return row ? containerOf(row) : null
}

// ---------------------------------------------------------------------------
// Writes: the cache first, the table behind it; a refusal is read back and said.
// ---------------------------------------------------------------------------

let onError: (message: string) => void = () => {}
/** The screen that is up hears a refused write in its own words (a toast); the job is read again either way. */
export function setOnSiteErrorHandler(cb: (message: string) => void): void {
  onError = cb
}

function afterWrite(jobId: string, what: string, p: PromiseLike<{ error: unknown }>): void {
  void Promise.resolve(p).then(
    ({ error }) => {
      if (!error) return
      onError(`${what} did not save: ${formatErrorMessage(error)}`)
      void loadJob(jobId, { force: true })
    },
    (e: unknown) => {
      onError(`${what} did not save: ${formatErrorMessage(e)}`)
      void loadJob(jobId, { force: true })
    },
  )
}

/** A place by name, made when missing; the same name twice is one place. */
export function addPlace(input: { jobId: string; name: string; byUserId?: string | null }): Place {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const c = cacheOf(input.jobId)
  const have = c.places.find((p) => p.name.toLowerCase() === name.toLowerCase())
  if (have) return have
  const p: Place = { id: newId(), jobId: input.jobId, name, createdAt: new Date().toISOString() }
  c.places = [...c.places, p]
  bump()
  afterWrite(input.jobId, `The place ${name}`, db.from('job_places').insert({ id: p.id, job_id: p.jobId, name, created_by: input.byUserId ?? null }))
  return p
}

export function addContainer(input: { jobId: string; label: string; kind: ContainerKind; where: string; locationId?: string | null; byUserId?: string | null }): Container {
  const c = cacheOf(input.jobId)
  const box: Container = { id: newId(), jobId: input.jobId, label: input.label.trim(), kind: input.kind, where: input.where.trim(), locationId: input.locationId ?? null, lat: null, lng: null, retiredAt: null, createdAt: new Date().toISOString() }
  c.containers = [...c.containers, box]
  bump()
  afterWrite(input.jobId, `The ${box.kind} ${box.label}`, db.from('job_containers').insert({ id: box.id, job_id: box.jobId, label: box.label, kind: box.kind, where_note: box.where, place_id: box.locationId, created_by: input.byUserId ?? null }))
  return box
}

/** The box itself moves to another place: its row changes and a move is kept, apart from its parts. */
export function moveContainer(containerId: string, toLocationId: string | null, byName: string, byUserId: string | null = null): void {
  for (const [jobId, c] of jobs) {
    const box = c.containers.find((x) => x.id === containerId)
    if (!box) continue
    if (box.locationId === toLocationId) return
    const mv: ContainerMove = { id: newId(), jobId, containerId, fromLocationId: box.locationId, toLocationId, byName, at: new Date().toISOString() }
    c.containers = c.containers.map((x) => (x.id === containerId ? { ...x, locationId: toLocationId } : x))
    c.moves = [...c.moves, mv]
    bump()
    afterWrite(jobId, `Moving ${box.label}`, db.from('job_containers').update({ place_id: toLocationId }).eq('id', containerId))
    afterWrite(jobId, `The move of ${box.label}`, db.from('job_container_moves').insert({ id: mv.id, container_id: containerId, from_place_id: mv.fromLocationId, to_place_id: toLocationId, by_user_id: byUserId, by_name: byName }))
    return
  }
}

/** The box's pin on the site map: where it stands, to a few metres. Null clears it. */
export function pinContainer(containerId: string, pin: { lat: number; lng: number } | null): void {
  for (const [jobId, c] of jobs) {
    const box = c.containers.find((x) => x.id === containerId)
    if (!box) continue
    c.containers = c.containers.map((x) => (x.id === containerId ? { ...x, lat: pin?.lat ?? null, lng: pin?.lng ?? null } : x))
    bump()
    afterWrite(jobId, `The pin on ${box.label}`, db.from('job_containers').update({ lat: pin?.lat ?? null, lng: pin?.lng ?? null }).eq('id', containerId))
    return
  }
}

/** The job's Unsorted row, made on first use: where a delivery lands until a crew puts it away. */
export function unsortedContainer(jobId: string, byUserId: string | null = null): Container {
  const have = cacheOf(jobId).containers.find((c) => c.kind === 'unsorted' && !c.retiredAt)
  if (have) return have
  return addContainer({ jobId, label: UNSORTED_LABEL, kind: 'unsorted', where: '', byUserId })
}

export function retireContainer(id: string): void {
  for (const [jobId, c] of jobs) {
    const box = c.containers.find((x) => x.id === id)
    if (!box) continue
    const at = new Date().toISOString()
    c.containers = c.containers.map((x) => (x.id === id ? { ...x, retiredAt: at } : x))
    bump()
    afterWrite(jobId, `Retiring ${box.label}`, db.from('job_containers').update({ retired_at: at }).eq('id', id))
    return
  }
}

export type AddMovementInput = {
  jobId: string
  partId: string | null
  partName: string
  manufacturer: string | null
  quantity: number
  reason: MovementReason
  fromContainerId: string | null
  toContainerId: string | null
  note?: string
  byUserId: string | null
  byName: string
  source?: string | null
  at?: string
}

export function addMovement(input: AddMovementInput): Movement {
  const c = cacheOf(input.jobId)
  const m: Movement = {
    id: newId(),
    jobId: input.jobId,
    partId: input.partId,
    partName: input.partName.trim(),
    manufacturer: input.manufacturer,
    quantity: Math.max(0, Math.round(input.quantity)),
    reason: input.reason,
    fromContainerId: input.fromContainerId,
    toContainerId: input.toContainerId,
    note: input.note ?? '',
    byUserId: input.byUserId,
    byName: input.byName,
    at: input.at ?? new Date().toISOString(),
    source: input.source ?? null,
    itemId: null,
  }
  c.movements = [...c.movements, m]
  bump()
  afterWrite(input.jobId, `${m.quantity} ${m.partName}`, db.from('job_material_movements').insert({ id: m.id, job_id: m.jobId, part_id: m.partId, part_name: m.partName, manufacturer: m.manufacturer, quantity: m.quantity, reason: m.reason, from_container_id: m.fromContainerId, to_container_id: m.toContainerId, note: m.note, source: m.source, by_user_id: m.byUserId, by_name: m.byName, at: m.at }))
  return m
}

/** A photo's note: the picture went to the bucket (or stayed on the phone); the sweep files it and writes the rest. */
export function addPhoto(p: PhotoNote): PhotoNote {
  const c = cacheOf(p.jobId)
  c.photos = [...c.photos, p]
  bump()
  afterWrite(p.jobId, 'The photo', db.from('job_box_photos').insert({ id: p.id, job_id: p.jobId, container_id: p.containerId, by_user_id: p.byUserId, by_name: p.byName, words: p.words ?? '', file_name: p.fileName, taken_at: p.at, bytes: p.bytes, width: p.width, height: p.height, status: p.status, storage_path: p.storagePath }))
  return p
}

export function updatePhoto(id: string, patch: Partial<Pick<PhotoNote, 'status' | 'storagePath' | 'driveFileId'>>): void {
  for (const [jobId, c] of jobs) {
    if (!c.photos.some((p) => p.id === id)) continue
    c.photos = c.photos.map((p) => (p.id === id ? { ...p, ...patch } : p))
    bump()
    const row: Record<string, unknown> = {}
    if (patch.status !== undefined) row.status = patch.status
    if (patch.storagePath !== undefined) row.storage_path = patch.storagePath
    if (patch.driveFileId !== undefined) row.drive_file_id = patch.driveFileId
    afterWrite(jobId, 'The photo', db.from('job_box_photos').update(row).eq('id', id))
    return
  }
}

// ---------------------------------------------------------------------------
// Prices remembered on this device (an invoice's unit price by part key) until the parts book is wired.
// ---------------------------------------------------------------------------

let prices: Record<string, number> | null = null
function readPrices(): Record<string, number> {
  if (prices) return prices
  try {
    prices = JSON.parse(localStorage.getItem(PRICES_KEY) ?? '{}') as Record<string, number>
  } catch {
    prices = {}
  }
  return prices
}

export function priceOf(key: string): number | null {
  return readPrices()[key] ?? null
}

export function rememberPrice(key: string, price: number): void {
  const next = { ...readPrices(), [key]: price }
  prices = next
  try {
    localStorage.setItem(PRICES_KEY, JSON.stringify(next))
  } catch {
    /* a private window keeps it for the page */
  }
  bump()
}
