import { booleanPointInPolygon, lineString, point, pointToLineDistance } from '@turf/turf'
import type { MultiPolygon, Polygon, Position } from 'geojson'

/**
 * The office's own court map (v2.4768, step 2 of the justice-court plan): named
 * precinct areas, drawn on the Map page or imported from a county's file, and the
 * rule that puts an address in one. Pure: the Map page, the nightly classification
 * and the property record read it; nothing here touches the database.
 */

export type CourtAreaPolygon = Polygon | MultiPolygon

export type CourtArea = {
  id: string
  county: string
  /** The county's own label — `2`, `1-2`, `3`. */
  precinct: string
  label: string
  polygon: CourtAreaPolygon
  source: 'drawn' | 'imported'
  sourceNote: string
  active: boolean
}

export type CourtClassification = {
  /** The county of the area the point is in; '' when in none. */
  county: string
  /** The precinct the point is in; '' when in none. */
  precinct: string
  /** Every precinct whose line is within `lineMetres` of the point, the one it is in first. */
  near: string[]
  /** True when `near` holds more than one precinct — a person settles it. */
  onLine: boolean
  /** `2 or 3 — on the line` · '' */
  note: string
  areaId: string | null
}

/** Within this many metres of a boundary, both sides are named. */
export const COURT_LINE_METRES = 100

function rings(p: CourtAreaPolygon): Position[][] {
  return p.type === 'Polygon' ? p.coordinates : p.coordinates.flat()
}

function isValidPolygon(p: unknown): p is CourtAreaPolygon {
  if (!p || typeof p !== 'object') return false
  const g = p as { type?: unknown; coordinates?: unknown }
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return false
  return Array.isArray(g.coordinates) && g.coordinates.length > 0
}

/** A `court_areas` row → an area; null when its polygon is not one. */
export function courtAreaFromRow(row: { id: string; county: string; precinct: string; label?: string | null; polygon: unknown; source?: string | null; source_note?: string | null; active?: boolean | null }): CourtArea | null {
  if (!isValidPolygon(row.polygon)) return null
  return {
    id: row.id,
    county: (row.county ?? '').trim(),
    precinct: (row.precinct ?? '').trim(),
    label: (row.label ?? '').trim(),
    polygon: row.polygon,
    source: row.source === 'imported' ? 'imported' : 'drawn',
    sourceNote: (row.source_note ?? '').trim(),
    active: row.active !== false,
  }
}

/** Metres from the point to the nearest edge of the area. */
export function metresToAreaEdge(pt: { lat: number; lng: number }, area: CourtArea): number {
  const p = point([pt.lng, pt.lat])
  let best = Number.POSITIVE_INFINITY
  for (const ring of rings(area.polygon)) {
    if (ring.length < 2) continue
    const d = pointToLineDistance(p, lineString(ring), { units: 'meters' })
    if (d < best) best = d
  }
  return best
}

/**
 * Which precinct an address is in. The active area holding the point names the
 * county and precinct; every other area of that county whose edge lies within
 * `lineMetres` is named beside it, so a point on a line reads *2 or 3 — on the line*
 * instead of one wrong answer. Areas of other counties are never near: the county
 * comes from the geocoder, not from this map.
 */
export function classifyCourtPoint(pt: { lat: number; lng: number }, areas: ReadonlyArray<CourtArea>, opts: { lineMetres?: number; county?: string } = {}): CourtClassification {
  const lineMetres = opts.lineMetres ?? COURT_LINE_METRES
  const live = areas.filter((a) => a.active && (!opts.county || a.county.toLowerCase() === opts.county.toLowerCase()))
  const p = point([pt.lng, pt.lat])
  const inside = live.find((a) => booleanPointInPolygon(p, a.polygon))
  const county = inside?.county ?? ''
  const near: string[] = []
  if (inside) near.push(inside.precinct)
  for (const a of live) {
    if (a === inside || (county && a.county !== county)) continue
    if (near.includes(a.precinct)) continue
    if (metresToAreaEdge(pt, a) <= lineMetres) near.push(a.precinct)
  }
  const onLine = near.length > 1
  return {
    county,
    precinct: inside?.precinct ?? '',
    near,
    onLine,
    note: onLine ? `${near.slice(0, -1).join(', ')} or ${near[near.length - 1]} — on the line` : '',
    areaId: inside?.id ?? null,
  }
}

/** `Guadalupe · JP Pct 2` · `Guadalupe · JP Pct 2 or 3 — on the line` · `outside every drawn area`. */
export function courtClassificationWords(c: CourtClassification): string {
  if (!c.precinct) return c.onLine ? `on the line: ${c.note}` : 'outside every drawn area'
  return c.onLine ? `${c.county} · JP Pct ${c.note}` : `${c.county} · JP Pct ${c.precinct}`
}

/** The coverage line for the Map page: how many pins the layer places, how many it does not. */
export function courtCoverageWords(placed: number, outside: number, onLine: number): string {
  const total = placed + outside
  const parts = [`${placed} of ${total} ${total === 1 ? 'address' : 'addresses'} inside a drawn area`]
  if (outside) parts.push(`${outside} outside every area`)
  if (onLine) parts.push(`${onLine} on a line to settle`)
  return parts.join(' · ')
}
