/**
 * Materials on site: a press as plain data (punch list #344, PR 1, v2.7173).
 *
 * Every write the on-site store makes is one or more rows named here: an insert under an id minted on the phone, or
 * a few columns changed on a box or a photo. Held as data, a press can be kept on the phone when there is no signal,
 * sent later in the order it was pressed, and drawn again over a fresh read of the job while it still waits. Before
 * this a press went to the table once and, with no signal, was lost behind a green toast.
 *
 * Pure: no client, no clock. `applyOnSiteWrites` is the one place a write becomes what the screen shows, so what a
 * press draws at once and what it draws again after a read are the same rows.
 */
import type { Container, ContainerKind, ContainerMove, Movement, MovementReason, Place } from './onSite'
import type { PhotoNote, PhotoStatus } from './photo'

export const ON_SITE_TABLES = ['job_places', 'job_containers', 'job_container_moves', 'job_material_movements', 'job_box_photos'] as const
export type OnSiteTable = (typeof ON_SITE_TABLES)[number]

/**
 * One row of a press. An insert's `row` is the whole row as the table takes it, its `id` among the columns. An
 * update's `row` holds only the columns that change, on the row named by `id`.
 */
export type OnSiteWrite = { table: OnSiteTable; op: 'insert' | 'update'; id: string; row: Record<string, unknown> }

/** The tables a press may change a row of. The ledger, the places and the box moves take inserts alone. */
const UPDATABLE: ReadonlySet<OnSiteTable> = new Set<OnSiteTable>(['job_containers', 'job_box_photos'])

/** Shape-check what a kept press holds: anything off is null, and the press is not sent. */
export function parseOnSiteWrites(raw: unknown): OnSiteWrite[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: OnSiteWrite[] = []
  for (const w of raw) {
    if (!w || typeof w !== 'object') return null
    const o = w as Record<string, unknown>
    if (typeof o.table !== 'string' || !(ON_SITE_TABLES as readonly string[]).includes(o.table)) return null
    if (o.op !== 'insert' && o.op !== 'update') return null
    if (typeof o.id !== 'string' || o.id.length === 0) return null
    if (!o.row || typeof o.row !== 'object' || Array.isArray(o.row)) return null
    const table = o.table as OnSiteTable
    if (o.op === 'update' && !UPDATABLE.has(table)) return null
    if (o.op === 'insert' && (o.row as Record<string, unknown>).id !== o.id) return null
    out.push({ table, op: o.op, id: o.id, row: o.row as Record<string, unknown> })
  }
  return out
}

/** What the screens hold of one job. */
export type OnSiteRows = { places: Place[]; containers: Container[]; moves: ContainerMove[]; movements: Movement[]; photos: PhotoNote[] }

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const has = (row: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(row, key)

/**
 * The job's rows with these writes drawn on them. `jobId` is the job the press was made on and `at` the moment it was
 * pressed, for a row whose own time the database stamps. An insert whose id the rows already hold changes nothing: the
 * read has it, so the press landed. An update of a row that is not there changes nothing either.
 */
export function applyOnSiteWrites(rows: OnSiteRows, writes: ReadonlyArray<OnSiteWrite>, jobId: string, at: string): OnSiteRows {
  let { places, containers, moves, movements, photos } = rows
  for (const w of writes) {
    const r = w.row
    if (w.table === 'job_places') {
      if (w.op !== 'insert' || places.some((p) => p.id === w.id)) continue
      places = [...places, { id: w.id, jobId, name: str(r.name), createdAt: at }]
    } else if (w.table === 'job_containers') {
      if (w.op === 'insert') {
        if (containers.some((c) => c.id === w.id)) continue
        containers = [...containers, { id: w.id, jobId, label: str(r.label), kind: (str(r.kind) || 'box') as ContainerKind, where: str(r.where_note), locationId: strOrNull(r.place_id), lat: null, lng: null, retiredAt: null, createdAt: at }]
      } else {
        containers = containers.map((c) =>
          c.id !== w.id
            ? c
            : {
                ...c,
                ...(has(r, 'place_id') ? { locationId: strOrNull(r.place_id) } : {}),
                ...(has(r, 'lat') ? { lat: numOrNull(r.lat) } : {}),
                ...(has(r, 'lng') ? { lng: numOrNull(r.lng) } : {}),
                ...(has(r, 'retired_at') ? { retiredAt: strOrNull(r.retired_at) } : {}),
                // Edit a box (v2.7179): its name, its kind and its where line, each only when the press sent it.
                ...(has(r, 'label') && str(r.label) ? { label: str(r.label) } : {}),
                ...(has(r, 'kind') && str(r.kind) ? { kind: str(r.kind) as ContainerKind } : {}),
                ...(has(r, 'where_note') ? { where: str(r.where_note) } : {}),
              },
        )
      }
    } else if (w.table === 'job_container_moves') {
      if (w.op !== 'insert' || moves.some((m) => m.id === w.id)) continue
      moves = [...moves, { id: w.id, jobId, containerId: str(r.container_id), fromLocationId: strOrNull(r.from_place_id), toLocationId: strOrNull(r.to_place_id), byName: str(r.by_name), at: str(r.at) || at }]
    } else if (w.table === 'job_material_movements') {
      if (w.op !== 'insert' || movements.some((m) => m.id === w.id)) continue
      movements = [
        ...movements,
        {
          id: w.id,
          jobId,
          partId: strOrNull(r.part_id),
          partName: str(r.part_name),
          manufacturer: strOrNull(r.manufacturer),
          quantity: numOrNull(r.quantity) ?? 0,
          reason: str(r.reason) as MovementReason,
          fromContainerId: strOrNull(r.from_container_id),
          toContainerId: strOrNull(r.to_container_id),
          note: str(r.note),
          byUserId: strOrNull(r.by_user_id),
          byName: str(r.by_name),
          at: str(r.at) || at,
          source: strOrNull(r.source),
          itemId: null,
        },
      ]
    } else {
      if (w.op === 'insert') {
        if (photos.some((p) => p.id === w.id)) continue
        photos = [
          ...photos,
          {
            id: w.id,
            jobId,
            containerId: str(r.container_id),
            fileName: str(r.file_name),
            byUserId: strOrNull(r.by_user_id),
            byName: str(r.by_name),
            at: str(r.taken_at) || at,
            bytes: numOrNull(r.bytes) ?? 0,
            width: numOrNull(r.width) ?? 0,
            height: numOrNull(r.height) ?? 0,
            status: (str(r.status) || 'sending') as PhotoStatus,
            driveFileId: null,
            storagePath: strOrNull(r.storage_path),
            words: str(r.words),
            failWhy: null,
          },
        ]
      } else {
        photos = photos.map((p) =>
          p.id !== w.id
            ? p
            : {
                ...p,
                ...(has(r, 'status') ? { status: str(r.status) as PhotoStatus } : {}),
                ...(has(r, 'storage_path') ? { storagePath: strOrNull(r.storage_path) } : {}),
                ...(has(r, 'drive_file_id') ? { driveFileId: strOrNull(r.drive_file_id) } : {}),
              },
        )
      }
    }
  }
  return { places, containers, moves, movements, photos }
}

/**
 * An insert sent a second time meets its own row: the first send landed and only its answer was lost. The database
 * says *duplicate key* on the table's primary key, and that is a landing, never a refusal. Any other duplicate (a
 * stencil a live box already carries, a place name twice) is a real no and keeps its reason. The key's detail is
 * hidden from a caller under row level security, so the constraint's name in the message is what is read.
 */
export function insertAlreadyLanded(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined, table: OnSiteTable): boolean {
  if (!error || error.code !== '23505') return false
  const message = error.message ?? ''
  if (message.includes(`"${table}_pkey"`) || message.includes(`${table}_pkey`)) return true
  return /^Key \(id\)=/.test((error.details ?? '').trim())
}

/** The words a kept press goes by where the queue lists it: what was pressed, as the screen said it. */
export function onSitePressAbout(what: string): string {
  return what.trim().replace(/\s+/g, ' ').slice(0, 120)
}
