/**
 * Permits (punch list #310): a point for a permit its city sent without one. About half of
 * Austin's permits come off the city's feed with no latitude, and almost every one of those
 * carries the appraisal district's id for its lot (`tcad_id`, the county layer's `geo_id`). The
 * county's parcel layer hands back the lot's shape for an id, and a point inside that shape is
 * the permit's point: the right lot, with no key and no paid call. The part of Austin over the
 * county line carries Williamson County's id, so a feed names every layer its rows' ids belong
 * to and each id goes to its own (punch list #320).
 *
 * Pure: `permit-pull` asks the layer, `src/lib/research/permitParcelPoints.test.ts` holds this.
 */
import type { PermitRow } from './permitFeed.ts'
import { askableParcelId, askablePoint, TRAVIS_PARCELS, WILLIAMSON_PARCELS } from './permitParcels.ts'

export type ParcelPoint = { lat: number; lng: number }

/** A parcel layer asked for shapes by id: where it is, the id a row carries, the question and the answer. */
export type ParcelPointSource = {
  /** The layer's query address. Asked by POST: a county's firewall turns away a long list of ids in a URL. */
  queryUrl: string
  /** The most ids one request carries. */
  idsPerRequest: number
  /** The parcel id a row carries, or null. */
  idOf: (row: PermitRow) => string | null
  /** The form one request posts for a list of ids. */
  query: (ids: readonly string[]) => URLSearchParams
  /** The point of every parcel in the layer's answer, by id. Throws with the layer's words when it refused the read. */
  pointsOf: (body: unknown) => Map<string, ParcelPoint>
}

/** Whether a row came with its point. */
export function hasPoint(row: Pick<PermitRow, 'lat' | 'lng'>): boolean {
  return row.lat != null && row.lng != null
}

/** The parcel id a row carries, by the first layer of a feed's that takes it: one row, one layer. */
export function idOfAny(sources: readonly ParcelPointSource[]): (row: PermitRow) => string | null {
  return (row) => {
    for (const source of sources) {
      const id = source.idOf(row)
      if (id) return id
    }
    return null
  }
}

/** The ids to ask the layer about: the rows with no point that carry an id, each id once, in the rows' order. */
export function parcelIdsToAsk(source: ParcelPointSource, rows: readonly PermitRow[]): string[] {
  const ids = new Set<string>()
  for (const row of rows) {
    if (hasPoint(row)) continue
    const id = source.idOf(row)
    if (id) ids.add(id)
  }
  return [...ids]
}

/** The ids in the lists one request each carries. */
export function idBatches(source: ParcelPointSource, ids: readonly string[]): string[][] {
  const size = Math.max(1, Math.floor(source.idsPerRequest))
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

type Vertex = [number, number]

function verticesOf(ring: unknown): Vertex[] {
  if (!Array.isArray(ring)) return []
  const out: Vertex[] = []
  for (const v of ring) {
    if (!Array.isArray(v)) continue
    const x = v[0]
    const y = v[1]
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) out.push([x, y])
  }
  return out
}

/** A ring's signed area and the sums its middle is made of; a closed ring's repeated last corner adds nothing. */
function shoelace(ring: readonly Vertex[]): { area: number; sx: number; sy: number } {
  let twice = 0
  let sx = 0
  let sy = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!
    const [x2, y2] = ring[(i + 1) % ring.length]!
    const cross = x1 * y2 - x2 * y1
    twice += cross
    sx += (x1 + x2) * cross
    sy += (y1 + y2) * cross
  }
  return { area: twice / 2, sx, sy }
}

/** Inside the shape by the even-odd rule over every ring, so a hole is outside and a second part is inside. */
function insideRings(rings: readonly Vertex[][], x: number, y: number): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i]!
      const [x2, y2] = ring[(i + 1) % ring.length]!
      if (y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) inside = !inside
    }
  }
  return inside
}

/** Smaller than a square centimetre in degrees: a line or a dot, not a lot. */
const NO_AREA = 1e-14

/**
 * A point inside a parcel's shape, from the rings a map layer hands back (`[lng, lat]` corners).
 * The biggest ring is the lot's outline, and its middle by area is the point. A bent lot (an L, a
 * flag, a horseshoe) can have its middle outside itself, so then the point is the middle of the
 * widest stretch of the lot along the line through that middle. Null for no shape, and for a
 * point outside Texas.
 */
export function pointOfRings(rings: unknown): ParcelPoint | null {
  const raw = (Array.isArray(rings) ? rings : []).map(verticesOf).filter((r) => r.length >= 3)
  const first = raw[0]?.[0]
  if (!first) return null
  // Measured from the shape's own first corner: in whole degrees the sums cancel and the middle drifts by metres.
  const [ox, oy] = first
  const local = raw.map((ring) => ring.map(([x, y]): Vertex => [x - ox, y - oy]))
  let outer = local[0]!
  let outerSums = shoelace(outer)
  for (const ring of local.slice(1)) {
    const sums = shoelace(ring)
    if (Math.abs(sums.area) > Math.abs(outerSums.area)) {
      outer = ring
      outerSums = sums
    }
  }
  let x: number
  let y: number
  if (Math.abs(outerSums.area) < NO_AREA) {
    x = outer.reduce((n, v) => n + v[0], 0) / outer.length
    y = outer.reduce((n, v) => n + v[1], 0) / outer.length
  } else {
    x = outerSums.sx / (6 * outerSums.area)
    y = outerSums.sy / (6 * outerSums.area)
    if (!insideRings(local, x, y)) {
      const crossings: number[] = []
      for (const ring of local) {
        for (let i = 0; i < ring.length; i++) {
          const [x1, y1] = ring[i]!
          const [x2, y2] = ring[(i + 1) % ring.length]!
          if (y1 > y !== y2 > y) crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
        }
      }
      crossings.sort((a, b) => a - b)
      let widest = 0
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const width = crossings[i + 1]! - crossings[i]!
        if (width > widest) {
          widest = width
          x = (crossings[i]! + crossings[i + 1]!) / 2
        }
      }
    }
  }
  const round = (v: number) => Math.round(v * 1e6) / 1e6
  return askablePoint(round(y + oy), round(x + ox))
}

/**
 * The point of every parcel in a map layer's answer, by the id in `idField`. An id the layer
 * holds under several features gives one point, from all of their rings together. Throws with
 * the layer's own words when it refused the read.
 */
export function parcelPointsOf(body: unknown, idField: string): Map<string, ParcelPoint> {
  const b = body as { error?: { message?: unknown }; features?: Array<{ attributes?: Record<string, unknown>; geometry?: { rings?: unknown } | null }> } | null
  if (!b || b.error || !Array.isArray(b.features)) throw new Error(`the parcel layer refused the read: ${String(b?.error?.message ?? JSON.stringify(b?.error ?? {})).slice(0, 300)}`)
  const ringsById = new Map<string, unknown[]>()
  for (const f of b.features) {
    const id = idText(f.attributes?.[idField])
    const rings = f.geometry?.rings
    if (!id || !Array.isArray(rings)) continue
    ringsById.set(id, [...(ringsById.get(id) ?? []), ...rings])
  }
  const out = new Map<string, ParcelPoint>()
  for (const [id, rings] of ringsById) {
    const point = pointOfRings(rings)
    if (point) out.set(id, point)
  }
  return out
}

function idText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const t = String(value).trim()
  return t === '' ? null : t
}

/**
 * The rows with their points filled, in two lists, because the pull writes them two ways:
 * - `settled`: a row that came with its point, a row that took its parcel's point, and a row
 *   whose parcel the layer does not hold. Its point is known, empty or not, and is written.
 * - `unknown`: a row with no point whose id the layer was not asked about or did not answer
 *   (`unanswered`). It is written without its point columns, so a point filled on an earlier
 *   night stands until the layer answers again.
 */
export function fillPoints(
  source: Pick<ParcelPointSource, 'idOf'>,
  rows: readonly PermitRow[],
  points: ReadonlyMap<string, ParcelPoint>,
  unanswered: ReadonlySet<string>,
): { settled: PermitRow[]; unknown: PermitRow[]; filled: number } {
  const settled: PermitRow[] = []
  const unknown: PermitRow[] = []
  let filled = 0
  for (const row of rows) {
    const id = hasPoint(row) ? null : source.idOf(row)
    const point = id ? points.get(id) : undefined
    if (point) {
      settled.push({ ...row, lat: point.lat, lng: point.lng })
      filled++
    } else if (id && unanswered.has(id)) {
      unknown.push(row)
    } else {
      settled.push(row)
    }
  }
  return { settled, unknown, filled }
}

/** A row as the pull writes it when its point is not known: every column but the point's two. */
export function withoutPointColumns<T extends { lat?: unknown; lng?: unknown }>(row: T): Omit<T, 'lat' | 'lng'> {
  const { lat: _lat, lng: _lng, ...rest } = row
  return rest
}

function quoted(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

/** The form that asks Travis County's parcel layer for the shapes of a list of `geo_id`s, in degrees. */
export function travisParcelQuery(ids: readonly string[]): URLSearchParams {
  return new URLSearchParams({
    where: ids.length === 0 ? '1 = 0' : `geo_id IN (${ids.map(quoted).join(',')})`,
    outFields: 'geo_id',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    f: 'json',
  })
}

/**
 * Travis County's parcels by the id an Austin permit carries. The city's `tcad_id` is the
 * layer's `geo_id` (ten digits, leading zeros kept), not its `PROP_ID`. A hundred ids in a URL
 * is turned away by the county's firewall; the same list posted as a form is answered. An id
 * that starts with R is Williamson County's and is left to its own layer.
 */
export const TRAVIS_PARCEL_POINTS: ParcelPointSource = {
  queryUrl: TRAVIS_PARCELS.queryUrl,
  idsPerRequest: 100,
  idOf: (row) => askableParcelId(TRAVIS_PARCELS, row.raw['tcad_id']),
  query: travisParcelQuery,
  pointsOf: (body) => parcelPointsOf(body, 'geo_id'),
}

/** The form that asks Williamson County's parcel layer for the shapes of a list of quick reference ids, in degrees. */
export function williamsonParcelQuery(ids: readonly string[]): URLSearchParams {
  return new URLSearchParams({
    where: ids.length === 0 ? '1 = 0' : `QuickRefID IN (${ids.map(quoted).join(',')})`,
    outFields: 'QuickRefID',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    f: 'json',
  })
}

/**
 * Williamson County's parcels by the id an Austin permit over the county line carries: the
 * appraisal district's quick reference id, an R and six digits, in the same `tcad_id`. Fifty ids
 * posted as a form were answered when it was tried, so that is one request.
 */
export const WILLIAMSON_PARCEL_POINTS: ParcelPointSource = {
  queryUrl: WILLIAMSON_PARCELS.queryUrl,
  idsPerRequest: 50,
  idOf: (row) => askableParcelId(WILLIAMSON_PARCELS, row.raw['tcad_id']),
  query: williamsonParcelQuery,
  pointsOf: (body) => parcelPointsOf(body, 'QuickRefID'),
}
