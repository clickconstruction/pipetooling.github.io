/**
 * Materials on site (punch list #209): the on-site store. A cache of each job's places, containers,
 * moves, movements and photo notes over the tables of `20261029010000_materials_on_site.sql`, with
 * the io beside it. Reads are plain functions over the cache, so a screen renders without waiting;
 * `loadJob` fills a job and `loadDesk` every job with a live container. A write lands in the cache at
 * once and goes to the table behind it; when the table refuses, the error handler hears why and the
 * job is read again, so the screen shows the truth. The ledger is append-only: a movement is never
 * edited. A line's money reads the parts book's price with its checked day (`priceFor`, the rule in
 * `bookPrice.ts`), read beside each job's ledger; a price typed off an invoice is remembered on this
 * device (`rememberPrice`) and stands in where the book's price is older than 90 days or missing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { ServerSummary } from './onSiteServerSummary'
import { formatErrorMessage } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { outbox } from '../offline/outboxState'
import { applyOnSiteWrites, parseOnSiteWrites, type OnSiteRows, type OnSiteWrite } from './onSiteWrites'
import { isPendingOnSitePress, onSiteSender, pendingOnSitePresses } from './onSiteSend'
import { ON_SITE_REFRESH_AFTER_MS, readIsStale } from './onSiteFresh'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { UNSORTED_LABEL, type Container, type ContainerKind, type ContainerMove, type Movement, type MovementReason, type Place } from './onSite'
import { boxCode } from './labels'
import { codeLookup, stickerFactsOf, type CodeLookup, type StickerFacts } from './stickers'
import type { PhotoNote, PhotoStatus } from './photo'
import { loadPartPriceRows } from './partPrices'
import { bookPartIds, bookPriceRow, priceLookup, type BookPriceRow, type PricePick } from './bookPrice'
import { tieCanon, type PartTie } from './partTies'
import type { TieScope } from './partTiesIo'
import { latestSitePrices, sitePriceLookup, type SitePrice } from './sitePrices'
import { deleteSitePrice, fetchAllSameTies, fetchAllSitePrices, fetchJobScopes, insertSitePrice, scopeKeyOf, type SitePriceInput } from './sitePricesIo'

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
  /** The ledger read came back full (v2.6743): `movements` holds the newest `MOVEMENTS_LIMIT` rows and `summary` the database's sums over them all. */
  capped: boolean
  summary: ServerSummary | null
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
let deskLoadedAt: number | null = null
let version = 0
const listeners = new Set<() => void>()

function bump(): void {
  version += 1
  for (const l of listeners) l()
}

function cacheOf(jobId: string): JobCache {
  let c = jobs.get(jobId)
  if (!c) {
    c = { places: [], containers: [], moves: [], movements: [], photos: [], capped: false, summary: null, loadedAt: null, loading: false, error: null, raw: null }
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

export type PlaceRow = { id: string; job_id: string; name: string; created_at: string }
export type ContainerRow = { id: string; job_id: string; label: string; kind: ContainerKind; where_note: string; place_id: string | null; lat: number | null; lng: number | null; retired_at: string | null; created_at: string }
type MoveRow = { id: string; container_id: string; from_place_id: string | null; to_place_id: string | null; by_name: string; at: string }
export type MovementRow = { id: string; job_id: string; part_id: string | null; part_name: string; manufacturer: string | null; quantity: number; reason: MovementReason; from_container_id: string | null; to_container_id: string | null; note: string; source: string | null; item_id: string | null; by_user_id: string | null; by_name: string; at: string }
type PhotoRow = { id: string; job_id: string; container_id: string; by_user_id: string | null; by_name: string; words: string; file_name: string; taken_at: string; bytes: number; width: number; height: number; status: PhotoStatus; storage_path: string | null; drive_file_id: string | null; filed_at: string | null; fail_why: string | null }

export const PLACE_COLS = 'id, job_id, name, created_at'
export const CONTAINER_COLS = 'id, job_id, label, kind, where_note, place_id, lat, lng, retired_at, created_at'
const MOVE_COLS = 'id, container_id, from_place_id, to_place_id, by_name, at'
export const MOVEMENT_COLS = 'id, job_id, part_id, part_name, manufacturer, quantity, reason, from_container_id, to_container_id, note, source, item_id, by_user_id, by_name, at'
const PHOTO_COLS = 'id, job_id, container_id, by_user_id, by_name, words, file_name, taken_at, bytes, width, height, status, storage_path, drive_file_id, filed_at, fail_why'

export const placeOf = (r: PlaceRow): Place => ({ id: r.id, jobId: r.job_id, name: r.name, createdAt: r.created_at })
export const containerOf = (r: ContainerRow): Container => ({ id: r.id, jobId: r.job_id, label: r.label, kind: r.kind, where: r.where_note ?? '', locationId: r.place_id, lat: r.lat, lng: r.lng, retiredAt: r.retired_at, createdAt: r.created_at })
const moveOf = (r: MoveRow, jobId: string): ContainerMove => ({ id: r.id, jobId, containerId: r.container_id, fromLocationId: r.from_place_id, toLocationId: r.to_place_id, byName: r.by_name ?? '', at: r.at })
export const movementOf = (r: MovementRow): Movement => ({ id: r.id, jobId: r.job_id, partId: r.part_id, partName: r.part_name, manufacturer: r.manufacturer, quantity: r.quantity, reason: r.reason, fromContainerId: r.from_container_id, toContainerId: r.to_container_id, note: r.note ?? '', byUserId: r.by_user_id, byName: r.by_name ?? '', at: r.at, source: r.source, itemId: r.item_id })
const photoOf = (r: PhotoRow): PhotoNote => ({ id: r.id, jobId: r.job_id, containerId: r.container_id, fileName: r.file_name, byUserId: r.by_user_id, byName: r.by_name ?? '', at: r.taken_at, bytes: r.bytes ?? 0, width: r.width ?? 0, height: r.height ?? 0, status: r.status, driveFileId: r.drive_file_id, storagePath: r.storage_path, words: r.words ?? '', failWhy: r.fail_why })

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

/**
 * One job's places, containers, moves, movements and photo notes into the cache. A second call while the first runs
 * waits on it. `quiet` is a read made again behind a screen that already shows the job (`refreshJob`): nothing reads
 * as loading, and a read that fails leaves the screen on its last good read with no error, since that read is still
 * true as of its time and the next refresh tries again.
 */
export function loadJob(jobId: string, opts: { force?: boolean; quiet?: boolean } = {}): Promise<void> {
  const running = inflight.get(jobId)
  if (running && !opts.force) return running
  const c = cacheOf(jobId)
  if (c.loadedAt && !opts.force && !c.error) return Promise.resolve()
  const quiet = Boolean(opts.quiet && c.loadedAt && !c.error)
  if (!quiet) {
    c.loading = true
    c.error = null
    c.raw = null
    bump()
  }
  const p = (async () => {
    try {
      // Every read is paged (v2.7160): PostgREST cuts an un-ranged answer at 1,000 rows without a word, so `.limit(5000)`
      // came back as the newest 1,000 and `capped` could never be true. A page that fails throws, as the read did before.
      const [places, containerRows, movementRowsNewestFirst, photos] = await Promise.all([
        fetchAllRows<PlaceRow>((from, to) => db.from('job_places').select(PLACE_COLS).eq('job_id', jobId).order('name').order('id').range(from, to), 'read the places on this job'),
        fetchAllRows<ContainerRow>((from, to) => db.from('job_containers').select(CONTAINER_COLS).eq('job_id', jobId).order('created_at').order('id').range(from, to), 'read the boxes on this job'),
        // Newest first (v2.6743): a job past the cap keeps its newest rows — the counts that reset its lines — not its oldest.
        fetchAllRows<MovementRow>(
          (from, to) => db.from('job_material_movements').select(MOVEMENT_COLS).eq('job_id', jobId).order('at', { ascending: false }).order('id', { ascending: false }).range(from, to),
          'read what was recorded on this job',
          undefined,
          { maxRows: MOVEMENTS_LIMIT },
        ),
        fetchAllRows<PhotoRow>((from, to) => db.from('job_box_photos').select(PHOTO_COLS).eq('job_id', jobId).order('taken_at', { ascending: true }).order('id').range(from, to), 'read the box photos on this job'),
      ])
      const ids = containerRows.map((r) => r.id)
      // Chunked over the box ids as well: a few hundred ids in one address is past what a request line carries.
      const moves = await fetchAllRowsChunkedIn<MoveRow, string>(ids, (chunk, from, to) => db.from('job_container_moves').select(MOVE_COLS).in('container_id', chunk).order('at', { ascending: true }).order('id').range(from, to), 'read where the boxes moved', { parallel: 4 })
      moves.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      const movementRows = movementRowsNewestFirst.map(movementOf).reverse()
      // What was pressed here and has not landed yet is drawn over the read (v2.7173), so a read never takes a kept press off the screen.
      const read = withPending(jobId, { places: places.map(placeOf), containers: containerRows.map(containerOf), moves: moves.map((r) => moveOf(r, jobId)), movements: movementRows, photos: photos.map(photoOf) })
      c.places = read.places
      c.containers = read.containers
      c.movements = read.movements
      c.capped = movementRows.length >= MOVEMENTS_LIMIT
      // Past the cap the device's sums would read a part of the ledger, so the database sums it whole (on_site_job_summary, v2.6743).
      c.summary = c.capped ? await loadServerSummary(jobId) : null
      c.photos = read.photos
      c.moves = read.moves
      c.loadedAt = Date.now()
      void loadBookPrices(bookPartIds(c.movements))
      void loadSitePricing([jobId])
    } catch (e) {
      if (!quiet) {
        c.error = formatErrorMessage(e, 'The boxes on this job did not load.')
        c.raw = e
      }
    } finally {
      if (!quiet) c.loading = false
      inflight.delete(jobId)
      bump()
    }
  })()
  inflight.set(jobId, p)
  return p
}

/** When the job was last read whole, epoch ms; null before its first read. */
export function jobLoadedAt(jobId: string): number | null {
  return jobs.get(jobId)?.loadedAt ?? null
}

/**
 * Read a job again when its last read is older than `olderThanMs` (v2.7177, punch list #344 PR 4): quietly, behind
 * the screen that shows it. A job never read, one being read, and one whose last read failed are left to their own
 * screens. The presses still on their way are drawn over the new read as over any (`withPending`).
 */
export function refreshJob(jobId: string, olderThanMs: number = ON_SITE_REFRESH_AFTER_MS, now: number = Date.now()): void {
  const c = jobs.get(jobId)
  if (!c || c.loading || c.error || inflight.has(jobId)) return
  if (!readIsStale(c.loadedAt, now, olderThanMs)) return
  void loadJob(jobId, { force: true, quiet: true })
}

/** The database's summary of a capped job (v2.6743). A refused or failed read throws, so the job's load reports it like any other. */
async function loadServerSummary(jobId: string): Promise<ServerSummary> {
  const { data, error } = await db.rpc('on_site_job_summary' as never, { p_job_id: jobId } as never)
  if (error) throw error
  return data as unknown as ServerSummary
}

/**
 * Every job with a live container, each loaded: the desk across jobs, the tools menu's count, the header's box search.
 * `quiet` is the desk read again behind its own screen (`refreshDesk`), with `loadJob`'s meaning.
 */
export function loadDesk(opts: { force?: boolean; quiet?: boolean } = {}): Promise<string[]> {
  if (deskPromise && !opts.force) return deskPromise
  if (deskIds && !opts.force) return Promise.resolve(deskIds)
  const quiet = Boolean(opts.quiet && deskIds && !deskError)
  if (!quiet) {
    deskLoading = true
    deskError = null
    deskRaw = null
    bump()
  }
  deskPromise = (async () => {
    try {
      const live = await fetchAllRows<{ job_id: string }>((from, to) => db.from('job_containers').select('job_id').is('retired_at', null).order('id').range(from, to), 'read the jobs with boxes')
      const ids = [...new Set(live.map((r) => r.job_id))]
      await Promise.all(ids.map((id) => loadJob(id, opts)))
      deskIds = ids
      deskLoadedAt = Date.now()
      return ids
    } catch (e) {
      if (!quiet) {
        deskError = formatErrorMessage(e, 'The materials desk did not load.')
        deskRaw = e
      }
      return deskIds ?? []
    } finally {
      if (!quiet) deskLoading = false
      deskPromise = null
      bump()
    }
  })()
  return deskPromise
}

/** The desk read again when its last read is older than `olderThanMs` (v2.7177): which jobs hold a box, and each of them, quietly. */
export function refreshDesk(olderThanMs: number = ON_SITE_REFRESH_AFTER_MS, now: number = Date.now()): void {
  if (!deskIds || deskLoading || deskError || deskPromise) return
  if (!readIsStale(deskLoadedAt, now, olderThanMs)) return
  void loadDesk({ force: true, quiet: true })
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

/** Whether the job's ledger read came back full, so `listMovements` is the newest 5,000 rows and the sums are the database's (v2.6743). */
export function jobLedgerCapped(jobId: string): boolean {
  return jobs.get(jobId)?.capped ?? false
}

/** The database's summary of a capped job, or null when the device read the whole ledger (v2.6743). */
export function serverSummary(jobId: string): ServerSummary | null {
  return jobs.get(jobId)?.summary ?? null
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

/** Stickers this device has read by their code (v2.7072, punch list #329), as they stood at that read. */
const stickersByCode = new Map<string, StickerFacts>()

function cachedContainer(containerId: string): Container | null {
  for (const c of jobs.values()) {
    const hit = c.containers.find((x) => x.id === containerId)
    if (hit) return hit
  }
  return null
}

function ownBoxByCode(code: string): Container | null {
  for (const c of jobs.values()) {
    const hit = c.containers.find((x) => !x.retiredAt && boxCode(x.id) === code)
    if (hit) return hit
  }
  return null
}

/**
 * The box a code names, from the cache: a sticker this device has read first (v2.7072), then a box's own label.
 * A sticker may have moved since it was read, so a scan asks the table (`resolveBoxCode`); this is the answer with no signal.
 */
export function findContainerByCode(code: string): Container | null {
  const sticker = stickersByCode.get(code)
  if (sticker) {
    const box = sticker.state === 'on_box' && sticker.containerId ? cachedContainer(sticker.containerId) : null
    return box && !box.retiredAt ? box : null
  }
  return ownBoxByCode(code)
}

/** The sticker a code names, as `sticker_by_code` answers it under the caller's session; null when no sticker carries it. */
async function fetchStickerByCode(code: string): Promise<StickerFacts | null> {
  const { data, error } = await db.rpc('sticker_by_code' as never, { p_code: code } as never)
  if (error) throw error
  const facts = stickerFactsOf(data)
  if (facts) stickersByCode.set(code, facts)
  else stickersByCode.delete(code)
  return facts
}

/**
 * The one resolver (v2.7072, punch list #329): what a scanned or typed code opens for someone signed in. A sticker's
 * code is asked first and a box's own beside it, in one round trip; `codeLookup` picks. A label printed before stickers
 * never depends on the sticker read: when that read fails and a box carries the code, the box opens, and the failure
 * is thrown only when nothing else answers.
 */
export async function resolveBoxCode(code: string): Promise<CodeLookup> {
  const cachedOwn = ownBoxByCode(code)
  const [stickerRead, ownRead] = await Promise.allSettled([
    fetchStickerByCode(code),
    cachedOwn
      ? Promise.resolve(cachedOwn)
      : db.from('job_containers').select(CONTAINER_COLS).eq('code', code).is('retired_at', null).limit(1).then(({ data, error }) => {
          if (error) throw error
          const row = ((data ?? []) as ContainerRow[])[0]
          return row ? containerOf(row) : null
        }),
  ])
  const sticker = stickerRead.status === 'fulfilled' ? stickerRead.value : null
  if (sticker) {
    let stickerBox: Container | null = null
    if (sticker.state === 'on_box' && sticker.containerId) {
      stickerBox = cachedContainer(sticker.containerId)
      if (!stickerBox) {
        // Under the reader's own RLS: a box on a job they are not on comes back as no row.
        const { data, error } = await db.from('job_containers').select(CONTAINER_COLS).eq('id', sticker.containerId).limit(1)
        if (error) throw error
        const row = ((data ?? []) as ContainerRow[])[0]
        stickerBox = row ? containerOf(row) : null
      }
    }
    return codeLookup({ sticker, stickerBox, ownBox: null })
  }
  const ownBox = ownRead.status === 'fulfilled' ? ownRead.value : null
  if (ownBox) return codeLookup({ sticker: null, stickerBox: null, ownBox })
  if (stickerRead.status === 'rejected') throw stickerRead.reason
  if (ownRead.status === 'rejected') throw ownRead.reason
  return { kind: 'none' }
}

/** The live box a code names, from the table: a sticker on it first, then its own label. Null for anything else. */
export async function fetchContainerByCode(code: string): Promise<Container | null> {
  const found = await resolveBoxCode(code)
  return found.kind === 'box' ? found.container : null
}

// ---------------------------------------------------------------------------
// Writes: the cache first, the table behind it; a refusal is read back and said.
// ---------------------------------------------------------------------------

let onError: (message: string, tone: 'error' | 'info') => void = () => {}
/**
 * The screen that is up hears a refused write in its own words (a toast); the job is read again either way. Since
 * v2.7173 it also hears, once, that a press is kept for want of signal: `tone` is `info` then, and `error` for a no.
 */
export function setOnSiteErrorHandler(cb: (message: string, tone: 'error' | 'info') => void): void {
  onError = cb
}

/**
 * A press, from here on (v2.7173, punch list #344 PR 1): its rows are drawn on the job at once (`applyOnSiteWrites`,
 * the one place a write becomes what the screen shows) and handed to the sender, which keeps them on the phone and
 * sends them in order (`onSiteSend.ts`). With no signal the press waits in the outbox and is drawn again over every
 * fresh read of the job until it lands. Only a refusal, the office answering no, takes it back off the screen: the
 * reason is said and the job is read again.
 */
function commit(jobId: string, what: string, writes: OnSiteWrite[]): void {
  const c = cacheOf(jobId)
  const pressedAt = Date.now()
  Object.assign(c, applyOnSiteWrites(c, writes, jobId, new Date(pressedAt).toISOString()))
  bump()
  void onSiteSender()
    .send({ jobId, what, writes, pressedAt })
    .then((outcome) => {
      if (outcome.kind === 'landed') return
      if (outcome.kind === 'queued') {
        // Said once, when the first press starts to wait; the bar on the strip counts the rest.
        if (outcome.first) onError(ON_SITE_KEPT_WORDS, 'info')
        return
      }
      onError(`${what} did not save: ${outcome.kind === 'refused' ? outcome.message : formatErrorMessage(outcome.error)}`, 'error')
      void loadJob(jobId, { force: true })
    })
}

/** What the phone says when a press starts to wait for signal. */
export const ON_SITE_KEPT_WORDS = 'No signal. What you press is kept on this phone and sends by itself.'

/** The presses still on their way for a job, drawn over what a read brought back, in the order they were pressed. */
function withPending(jobId: string, rows: OnSiteRows): OnSiteRows {
  let out = rows
  for (const p of pendingOnSitePresses(jobId, onSiteSender(), outbox)) {
    const writes = parseOnSiteWrites(p.payload.writes)
    if (writes) out = applyOnSiteWrites(out, writes, jobId, new Date(p.pressedAt).toISOString())
  }
  return out
}

/**
 * A press the outbox gave up on: the office refused it on a later try, or the person dropped it from the list. Its
 * rows are still drawn, so the job is read again and the screen shows what the office holds. A press that landed
 * needs no read: its rows are the office's now.
 */
const waitingByPress = new Map<string, string>()
outbox.subscribe(() => {
  const now = new Map<string, string>()
  const landed = new Set<string>()
  for (const p of outbox.presses()) {
    if (p.kind !== 'on-site-press') continue
    if (p.state === 'sent') landed.add(p.id)
    else if (isPendingOnSitePress(p)) now.set(p.id, p.payload.jobId)
  }
  const reread = new Set<string>()
  for (const [id, jobId] of waitingByPress) if (!now.has(id) && !landed.has(id)) reread.add(jobId)
  waitingByPress.clear()
  for (const [id, jobId] of now) waitingByPress.set(id, jobId)
  for (const jobId of reread) if (jobs.get(jobId)?.loadedAt) void loadJob(jobId, { force: true })
})

/** A place by name, made when missing; the same name twice is one place. */
export function addPlace(input: { jobId: string; name: string; byUserId?: string | null }): Place {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const c = cacheOf(input.jobId)
  const have = c.places.find((p) => p.name.toLowerCase() === name.toLowerCase())
  if (have) return have
  const id = newId()
  commit(input.jobId, `The place ${name}`, [{ table: 'job_places', op: 'insert', id, row: { id, job_id: input.jobId, name, created_by: input.byUserId ?? null } }])
  return c.places.find((p) => p.id === id)!
}

export function addContainer(input: { jobId: string; label: string; kind: ContainerKind; where: string; locationId?: string | null; byUserId?: string | null }): Container {
  const c = cacheOf(input.jobId)
  const id = newId()
  const label = input.label.trim()
  commit(input.jobId, `The ${input.kind} ${label}`, [{ table: 'job_containers', op: 'insert', id, row: { id, job_id: input.jobId, label, kind: input.kind, where_note: input.where.trim(), place_id: input.locationId ?? null, created_by: input.byUserId ?? null } }])
  return c.containers.find((x) => x.id === id)!
}

/** The box itself moves to another place: its row changes and a move is kept, apart from its parts. */
export function moveContainer(containerId: string, toLocationId: string | null, byName: string, byUserId: string | null = null): void {
  for (const [jobId, c] of jobs) {
    const box = c.containers.find((x) => x.id === containerId)
    if (!box) continue
    if (box.locationId === toLocationId) return
    const id = newId()
    // One press, two rows, in this order: the box's place, then the move that records it, stamped when pressed.
    commit(jobId, `Moving ${box.label}`, [
      { table: 'job_containers', op: 'update', id: containerId, row: { place_id: toLocationId } },
      { table: 'job_container_moves', op: 'insert', id, row: { id, container_id: containerId, from_place_id: box.locationId, to_place_id: toLocationId, by_user_id: byUserId, by_name: byName, at: new Date().toISOString() } },
    ])
    return
  }
}

/** The box's pin on the site map: where it stands, to a few metres. Null clears it. */
export function pinContainer(containerId: string, pin: { lat: number; lng: number } | null): void {
  for (const [jobId, c] of jobs) {
    const box = c.containers.find((x) => x.id === containerId)
    if (!box) continue
    commit(jobId, `The pin on ${box.label}`, [{ table: 'job_containers', op: 'update', id: containerId, row: { lat: pin?.lat ?? null, lng: pin?.lng ?? null } }])
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
    commit(jobId, `Retiring ${box.label}`, [{ table: 'job_containers', op: 'update', id, row: { retired_at: new Date().toISOString() } }])
    return
  }
}

/** The way back from `retireContainer` (owner's ask, 2026-11-03): clears the retire so the box is live again on both pages and its QR label resolves. Callers run `unretireVerdict` first. */
export function unretireContainer(id: string): void {
  for (const [jobId, c] of jobs) {
    const box = c.containers.find((x) => x.id === id)
    if (!box) continue
    commit(jobId, `Bringing back ${box.label}`, [{ table: 'job_containers', op: 'update', id, row: { retired_at: null } }])
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
  const id = newId()
  const partName = input.partName.trim()
  const quantity = Math.max(0, Math.round(input.quantity))
  commit(input.jobId, `${quantity} ${partName}`, [
    {
      table: 'job_material_movements',
      op: 'insert',
      id,
      row: { id, job_id: input.jobId, part_id: input.partId, part_name: partName, manufacturer: input.manufacturer, quantity, reason: input.reason, from_container_id: input.fromContainerId, to_container_id: input.toContainerId, note: input.note ?? '', source: input.source ?? null, by_user_id: input.byUserId, by_name: input.byName, at: input.at ?? new Date().toISOString() },
    },
  ])
  if (input.partId) void loadBookPrices([input.partId])
  return c.movements.find((m) => m.id === id)!
}

/** A photo's note: the picture went to the bucket (or stayed on the phone); the sweep files it and writes the rest. */
export function addPhoto(p: PhotoNote): PhotoNote {
  commit(p.jobId, 'The photo', [{ table: 'job_box_photos', op: 'insert', id: p.id, row: { id: p.id, job_id: p.jobId, container_id: p.containerId, by_user_id: p.byUserId, by_name: p.byName, words: p.words ?? '', file_name: p.fileName, taken_at: p.at, bytes: p.bytes, width: p.width, height: p.height, status: p.status, storage_path: p.storagePath } }])
  return cacheOf(p.jobId).photos.find((x) => x.id === p.id) ?? p
}

export function updatePhoto(id: string, patch: Partial<Pick<PhotoNote, 'status' | 'storagePath' | 'driveFileId'>>): void {
  for (const [jobId, c] of jobs) {
    if (!c.photos.some((p) => p.id === id)) continue
    const row: Record<string, unknown> = {}
    if (patch.status !== undefined) row.status = patch.status
    if (patch.storagePath !== undefined) row.storage_path = patch.storagePath
    if (patch.driveFileId !== undefined) row.drive_file_id = patch.driveFileId
    commit(jobId, 'The photo', [{ table: 'job_box_photos', op: 'update', id, row }])
    return
  }
}

// ---------------------------------------------------------------------------
// Prices: the parts book's rows for the parts a ledger names (read once per part, beside the job's
// load), and the invoice prices remembered on this device by part key. `priceFor` is the one rule.
// ---------------------------------------------------------------------------

const bookPrices = new Map<string, BookPriceRow[]>()
const bookPricesAsked = new Set<string>()
let bookPricesError: string | null = null
let bookPricesLoading = 0

/** How the parts book's read stands: the reason when a read failed (the money then reads the invoice prices alone), and whether one is running. */
export function bookPricesState(): { error: string | null; loading: boolean } {
  return { error: bookPricesError, loading: bookPricesLoading > 0 }
}

/** The parts book's prices for these parts, the ones not read yet; a failed read is said and asked again on the next call with the same parts. */
export async function loadBookPrices(partIds: ReadonlyArray<string>): Promise<void> {
  const ids = partIds.filter((id) => id && !bookPricesAsked.has(id))
  if (ids.length === 0) return
  for (const id of ids) bookPricesAsked.add(id)
  bookPricesLoading += 1
  try {
    const rows = await loadPartPriceRows<{ part_id: string; price: number; effective_date: string | null; updated_at: string | null; supply_houses: { name: string } | null }>(supabase, ids, 'part_id, price, effective_date, updated_at, supply_houses(name)', { label: 'read the parts book’s prices', retry: true })
    for (const id of ids) bookPrices.set(id, [])
    for (const r of rows) bookPrices.get(r.part_id)?.push(bookPriceRow(r))
    bookPricesError = null
  } catch (e) {
    for (const id of ids) bookPricesAsked.delete(id)
    bookPricesError = formatErrorMessage(e, 'The parts book’s prices did not load.')
  } finally {
    bookPricesLoading -= 1
    bump()
  }
}

/** Read the parts book again for every part the loaded ledgers name, after a failed read. */
export function retryBookPrices(): Promise<void> {
  const ids = new Set<string>()
  for (const c of jobs.values()) for (const id of bookPartIds(c.movements)) if (!bookPrices.has(id)) ids.add(id)
  return loadBookPrices([...ids])
}

/** The price a line's money reads, with where it came from and when it was checked; null when nothing is known. */
export function priceFor(key: string): PricePick | null {
  return priceLookup((id) => bookPrices.get(id) ?? [], (k) => readPrices()[k] ?? null, todayYmdInAppTz())(key)
}

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

/** The number alone, for the sums (`officeFlow`, `manifestComparison`, `jobMaterialsSummary`). */
export function priceOf(key: string): number | null {
  return priceFor(key)?.price ?? null
}

/** An invoice's unit price for a part key, kept on this device: the fallback past the book's 90 days, and the only price a typed name has. */
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

// ---------------------------------------------------------------------------
// A site's own prices and its ties (punch list #342, PR 2): `on_site_prices` and the `same` rows of
// `on_site_part_ties`, read once beside the first job's load, and each job's site. `priceForJob` is the one
// rule with them in it (`sitePriceLookup`): a job's Missing table, the desk's missing money and a site's Worth
// read the same price. A reader the table gives nothing to (a field role) gets the old rule's answer.
// ---------------------------------------------------------------------------

const scopeOfJob = new Map<string, string>()
const scopesAsked = new Set<string>()
const sitePriceRows = new Map<string, SitePrice[]>()
const siteTies = new Map<string, PartTie[]>()
const latestCache = new Map<string, Map<string, SitePrice>>()
const canonCache = new Map<string, (key: string) => string>()
let sitePricingRead: Promise<void> | null = null
let sitePricingOk = false

/** The site's-own-prices table was read: false before its migration is pushed, or for a role it gives nothing to. */
export function sitePricingAvailable(): boolean {
  return sitePricingOk
}

function tiedPartIds(ties: ReadonlyArray<PartTie>): string[] {
  const ids = new Set<string>()
  for (const t of ties) for (const k of [t.aKey, t.bKey]) if (k.startsWith('id:')) ids.add(k.slice(3))
  return [...ids]
}

/** Each job's site, and every site's prices and ties, the ones not read yet. Never throws: a refused read leaves the old rule standing. */
export function loadSitePricing(jobIds: ReadonlyArray<string>): Promise<void> {
  const fresh = jobIds.filter((id) => id && !scopesAsked.has(id))
  for (const id of fresh) scopesAsked.add(id)
  const scopes = fresh.length
    ? fetchJobScopes(fresh)
        .then((m) => {
          for (const [job, scope] of m) scopeOfJob.set(job, scope)
        })
        .catch(() => {
          for (const id of fresh) scopesAsked.delete(id)
        })
    : Promise.resolve()
  if (!sitePricingRead) {
    sitePricingRead = (async () => {
      const [prices, ties] = await Promise.allSettled([fetchAllSitePrices(), fetchAllSameTies()])
      if (prices.status === 'fulfilled') {
        sitePriceRows.clear()
        for (const [scope, rows] of prices.value) sitePriceRows.set(scope, rows)
        latestCache.clear()
        sitePricingOk = true
      } else {
        // Asked again with the next job: the table may not be there yet.
        sitePricingRead = null
      }
      if (ties.status === 'fulfilled') {
        for (const [scope, rows] of ties.value) {
          // A screen that holds the site's ties itself (`setScopeTies`) is newer than this read.
          if (!siteTies.has(scope)) siteTies.set(scope, rows)
          void loadBookPrices(tiedPartIds(rows))
        }
        canonCache.clear()
      }
    })()
  }
  return Promise.all([scopes, sitePricingRead]).then(() => bump())
}

function latestOf(scopeKey: string): Map<string, SitePrice> {
  let latest = latestCache.get(scopeKey)
  if (!latest) {
    latest = latestSitePrices(sitePriceRows.get(scopeKey) ?? [])
    latestCache.set(scopeKey, latest)
  }
  return latest
}

function canonOf(scopeKey: string): (key: string) => string {
  let canon = canonCache.get(scopeKey)
  if (!canon) {
    canon = tieCanon(siteTies.get(scopeKey) ?? [])
    canonCache.set(scopeKey, canon)
  }
  return canon
}

/** The price a line reads on one site, by its part key. `canon` is the site's ties when the caller holds them fresher than the store. */
export function priceForScope(scopeKey: string, key: string, canon?: (key: string) => string): PricePick | null {
  const latest = latestOf(scopeKey)
  return sitePriceLookup({ book: (id) => bookPrices.get(id) ?? [], invoice: (k) => readPrices()[k] ?? null, site: (k) => latest.get(k), canon: canon ?? canonOf(scopeKey), today: todayYmdInAppTz() })(key)
}

/** The price a job's line reads: through its site's prices and ties once they were read, the old rule until then. */
export function priceForJob(jobId: string, key: string): PricePick | null {
  const scope = scopeOfJob.get(jobId)
  return scope ? priceForScope(scope, key) : priceFor(key)
}

/** The number alone, for a job's sums. */
export function priceOfJob(jobId: string, key: string): number | null {
  return priceForJob(jobId, key)?.price ?? null
}

/** Every answer given about a site's rows, oldest first. */
export function listSitePrices(scope: TieScope): SitePrice[] {
  return sitePriceRows.get(scopeKeyOf(scope)) ?? []
}

/** One answer: a price accepted for a row, or the row left out. Throws the table's refusal. */
export async function addSitePrice(scope: TieScope, input: SitePriceInput, byName: string): Promise<SitePrice> {
  const row = await insertSitePrice(scope, input, byName)
  const key = scopeKeyOf(scope)
  sitePriceRows.set(key, [...(sitePriceRows.get(key) ?? []), row])
  latestCache.delete(key)
  bump()
  return row
}

/** Take one answer back: the row reads what it read before. Throws the table's refusal. */
export async function removeSitePrice(scope: TieScope, id: string): Promise<void> {
  await deleteSitePrice(id)
  const key = scopeKeyOf(scope)
  sitePriceRows.set(key, (sitePriceRows.get(key) ?? []).filter((r) => r.id !== id))
  latestCache.delete(key)
  bump()
}

/** A site's screen holds its ties itself and hands them over, so a job's page prices a tied name the same way at once. */
export function setScopeTies(scope: TieScope, ties: ReadonlyArray<PartTie>): void {
  const key = scopeKeyOf(scope)
  const same = ties.filter((t) => t.verdict === 'same')
  const before = siteTies.get(key)
  if (before && before.length === same.length && before.every((t, i) => t.id === same[i]!.id)) return
  siteTies.set(key, same)
  canonCache.delete(key)
  void loadBookPrices(tiedPartIds(same))
  bump()
}
